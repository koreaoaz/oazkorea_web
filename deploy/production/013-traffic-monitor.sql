-- Main supplemental series after 012. Additive and deliberately single-use.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $$
BEGIN
 IF current_user<>'postgres' OR to_regprocedure('oaz_gateway_v1.assert_gate()') IS NULL
   OR NOT EXISTS(SELECT FROM oaz_gateway_v1.config WHERE id)
   OR to_regnamespace('oaz_admin_clock') IS NULL
   OR (SELECT array_agg(step ORDER BY step) FROM oaz_release.applied) IS DISTINCT FROM ARRAY(SELECT generate_series(1,43))
   OR to_regnamespace('oaz_traffic_v1') IS NOT NULL
   OR EXISTS(SELECT FROM pg_proc WHERE pronamespace='public'::regnamespace AND starts_with(proname,'oaz_traffic_'))
 THEN RAISE EXCEPTION 'TRAFFIC_013_PREFLIGHT_STOP'; END IF;
END $$;
CREATE SCHEMA oaz_traffic_v1;
REVOKE ALL ON SCHEMA oaz_traffic_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE oaz_traffic_v1.epoch(id boolean PRIMARY KEY CHECK(id), started timestamptz NOT NULL DEFAULT now());
INSERT INTO oaz_traffic_v1.epoch(id) VALUES(true);
CREATE TABLE oaz_traffic_v1.days(day date PRIMARY KEY, n bigint NOT NULL CHECK(n>=0));
CREATE TABLE oaz_traffic_v1.seen(day date NOT NULL, tag bytea NOT NULL CHECK(octet_length(tag)=32), PRIMARY KEY(day,tag));
CREATE TABLE oaz_traffic_v1.limits(minute timestamptz NOT NULL, bucket bytea NOT NULL, n integer NOT NULL CHECK(n>0), PRIMARY KEY(minute,bucket));
CREATE TABLE oaz_traffic_v1.checks(day date PRIMARY KEY, checked timestamptz NOT NULL, last_ok timestamptz, last_cron timestamptz, result text NOT NULL, latency_ms integer NOT NULL);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['epoch','days','seen','limits','checks'] LOOP
 EXECUTE format('ALTER TABLE oaz_traffic_v1.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE oaz_traffic_v1.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'FUNCTION_OWNER_REQUIRED'; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA oaz_traffic_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.oaz_traffic_stats_v1() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE k date:=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 RETURN (SELECT jsonb_build_object('day',k,'today',coalesce(max(n) FILTER(WHERE day=k),0),'total',coalesce(sum(n),0),
 'refreshMs',ceil(extract(epoch FROM (((k+1)::timestamp AT TIME ZONE 'Asia/Seoul')-statement_timestamp()))*1000))
 FROM oaz_traffic_v1.days);
END $$;
CREATE FUNCTION public.oaz_traffic_visit_v1(day_key date, browser_tag text, network_tag text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k date:=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
 m timestamptz:=date_trunc('minute',statement_timestamp()); throttle_key bytea; cap integer; hits integer; added integer;
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF day_key IS DISTINCT FROM k THEN RAISE SQLSTATE 'PT409' USING MESSAGE='DAY_CHANGED'; END IF;
 IF browser_tag IS NULL OR network_tag IS NULL OR browser_tag !~ '^[0-9a-f]{64}$' OR network_tag !~ '^[0-9a-f]{64}$' THEN RAISE invalid_parameter_value; END IF;
 FOREACH throttle_key IN ARRAY ARRAY[''::bytea,decode(network_tag,'hex')] LOOP
   cap:=CASE WHEN length(throttle_key)=0 THEN 600 ELSE 30 END;
   INSERT INTO oaz_traffic_v1.limits AS l VALUES(m,throttle_key,1) ON CONFLICT(minute,bucket) DO UPDATE SET n=l.n+1 WHERE l.n<cap RETURNING n INTO hits;
   IF hits IS NULL THEN RAISE SQLSTATE 'PT429' USING MESSAGE='RATE_LIMIT'; END IF;
 END LOOP;
 DELETE FROM oaz_traffic_v1.limits WHERE minute<m-interval '1 minute';
 DELETE FROM oaz_traffic_v1.seen WHERE day<k;
 INSERT INTO oaz_traffic_v1.seen VALUES(k,decode(browser_tag,'hex')) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 IF added=1 THEN INSERT INTO oaz_traffic_v1.days AS d VALUES(k,1) ON CONFLICT(day) DO UPDATE SET n=d.n+1; END IF;
 RETURN public.oaz_traffic_stats_v1();
END $$;
CREATE FUNCTION public.oaz_traffic_check_v1(outcome text,elapsed integer,scheduled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ts timestamptz:=statement_timestamp(); k date:=(ts AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF scheduled IS NULL OR outcome IS NULL OR outcome NOT IN ('ok','db_error','timeout','config_error') OR elapsed IS NULL OR elapsed NOT BETWEEN 0 AND 60000 THEN RAISE invalid_parameter_value; END IF;
 INSERT INTO oaz_traffic_v1.checks AS c VALUES(k,ts,CASE WHEN outcome='ok' THEN ts END,CASE WHEN scheduled THEN ts END,outcome,elapsed)
 ON CONFLICT(day) DO UPDATE SET checked=greatest(c.checked,excluded.checked),last_ok=greatest(c.last_ok,excluded.last_ok),
 last_cron=greatest(c.last_cron,excluded.last_cron),
 result=CASE WHEN c.checked<=excluded.checked THEN excluded.result ELSE c.result END,
 latency_ms=CASE WHEN c.checked<=excluded.checked THEN excluded.latency_ms ELSE c.latency_ms END;
 DELETE FROM oaz_traffic_v1.seen WHERE day<k;
 DELETE FROM oaz_traffic_v1.limits WHERE minute<date_trunc('minute',ts)-interval '1 minute';
 DELETE FROM oaz_traffic_v1.checks WHERE day<k-89;
END $$;
CREATE FUNCTION public.oaz_traffic_status_v1() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF (SELECT role FROM oaz_final.actor(false)) IS DISTINCT FROM 'SUPER_ADMIN' OR (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE insufficient_privilege; END IF;
 RETURN jsonb_build_object('started',(SELECT started FROM oaz_traffic_v1.epoch WHERE id),
 'latest',(SELECT jsonb_build_object('at',checked,'result',result,'ms',latency_ms) FROM oaz_traffic_v1.checks ORDER BY day DESC LIMIT 1),
 'lastCron',(SELECT max(last_cron) FROM oaz_traffic_v1.checks),
 'lastOk',(SELECT max(last_ok) FROM oaz_traffic_v1.checks));
END $$;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.oaz_traffic_stats_v1()'::regprocedure,'public.oaz_traffic_visit_v1(date,text,text)'::regprocedure,
 'public.oaz_traffic_check_v1(text,integer,boolean)'::regprocedure,'public.oaz_traffic_status_v1()'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f);
 END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.oaz_traffic_status_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.oaz_traffic_status_v1() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
