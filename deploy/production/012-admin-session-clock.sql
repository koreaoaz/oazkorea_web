-- Main SQL Editor. Requires the reviewed staged schema and intact dependency contracts.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF current_user <> 'postgres' OR to_regnamespace('oaz_admin_clock') IS NOT NULL
 OR to_regprocedure('oaz_gateway_v1.assert_gate()') IS NULL
 OR NOT EXISTS (SELECT FROM oaz_release.staged_state WHERE id AND phase='contracted')
 THEN RAISE EXCEPTION 'ADMIN_CLOCK_BASELINE_REQUIRED'; END IF;
END$$;
-- Existing signed uploads expire independently of Auth. A recent permit can
-- have issued one until its own expiry; the existing provider limit is 7260s.
LOCK TABLE oaz_user_storage.permits IN SHARE MODE;
DO $$DECLARE safe_after timestamptz; BEGIN
 SELECT max(expires)+interval '7260 seconds' INTO safe_after FROM oaz_user_storage.permits;
 IF safe_after>=clock_timestamp() THEN RAISE EXCEPTION 'PREVIOUS_UPLOAD_WINDOW_OPEN_UNTIL %',safe_after; END IF;
END$$;
CREATE SCHEMA oaz_admin_clock;
REVOKE ALL ON SCHEMA oaz_admin_clock FROM PUBLIC,anon,authenticated,service_role;
-- Owner-only definitions for a coordinated rollback. No Auth or content data.
CREATE TABLE oaz_admin_clock.prior_definitions AS
 SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition,p.proowner,p.proacl
 FROM pg_proc p WHERE p.oid IN ('oaz_password.live_session()'::regprocedure,'oaz_final.actor(boolean)'::regprocedure,
 'public.oaz_gateway_v1(text,jsonb)'::regprocedure,'public.oaz_public_content_meta_v1(text,bigint)'::regprocedure);
REVOKE ALL ON oaz_admin_clock.prior_definitions FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE oaz_admin_clock.extensions (
 session_id uuid NOT NULL, user_id uuid NOT NULL, extended_at timestamptz NOT NULL,
 PRIMARY KEY(session_id,user_id,extended_at)
);
ALTER TABLE oaz_admin_clock.extensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oaz_admin_clock.extensions FROM PUBLIC,anon,authenticated,service_role;

-- Refresh changes iat and the AMR update timestamp. Neither starts a new lease.
CREATE FUNCTION oaz_admin_clock.deadline() RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT greatest(coalesce(
   CASE WHEN a.slot='admin1' AND s.aal='aal2' THEN
    (SELECT min(m.created_at) FROM auth.mfa_amr_claims m
     WHERE m.session_id=s.id AND m.authentication_method IN ('mfa/totp','totp'))
   END,s.created_at),
   (SELECT max(e.extended_at) FROM oaz_admin_clock.extensions e
    WHERE e.session_id=s.id AND e.user_id=s.user_id)) + interval '30 minutes'
 FROM auth.sessions s JOIN oaz_admin_v2.assignments a ON a.user_id=s.user_id
 WHERE s.id=(auth.jwt()->>'session_id')::uuid AND s.user_id=auth.uid()
$$;
REVOKE ALL ON FUNCTION oaz_admin_clock.deadline() FROM PUBLIC,anon,authenticated,service_role;

-- Preserve function OIDs, owner, privileges, stability, search_path and every existing check.
DO $install$
DECLARE sig text; p pg_proc; old_body text; new_body text; old_def text; expected_body text;
BEGIN
 FOREACH sig IN ARRAY ARRAY['oaz_password.live_session()','oaz_final.actor(boolean)'] LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=sig::regprocedure;
  old_body:=p.prosrc; old_def:=pg_get_functiondef(p.oid);
  expected_body:=CASE sig WHEN 'oaz_password.live_session()' THEN '17214b19a71e9e5d746fcfc5db3f5b0d288c9116702ceb7234e460d596df9310' ELSE '8919dcd3ea32b7efec0200c4f428b814f1a0856bdbd6bd5d663336719a36b3bc' END;
  IF NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
   OR encode(sha256(convert_to(replace(old_body,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>expected_body
   OR NOT EXISTS(SELECT FROM oaz_final.server_dependency_contract d WHERE d.function_oid=p.oid
   AND d.owner_oid=p.proowner AND d.acl IS NOT DISTINCT FROM p.proacl
   AND d.definition_sha256=encode(sha256(convert_to(old_def,'UTF8')),'hex'))
   THEN RAISE EXCEPTION 'ADMIN_CLOCK_CONTRACT_MISMATCH %',sig; END IF;
  IF sig='oaz_password.live_session()' THEN
   new_body:=replace(old_body,'SELECT auth.role()', 'SELECT coalesce(oaz_admin_clock.deadline()>statement_timestamp(),false) AND auth.role()');
  ELSE
   new_body:=replace(old_body,'RETURN oaz_final.before_staged_actor',
    'IF (oaz_admin_clock.deadline()>statement_timestamp()) IS NOT TRUE THEN RAISE insufficient_privilege; END IF; RETURN oaz_final.before_staged_actor');
  END IF;
  IF new_body=old_body THEN RAISE EXCEPTION 'CLOCK_GUARD_MISSING'; END IF;
  EXECUTE replace(old_def,old_body,new_body);
  UPDATE oaz_final.server_dependency_contract SET definition_sha256=encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') WHERE function_oid=p.oid;
 END LOOP;
END $install$;

CREATE FUNCTION public.oaz_admin_clock_v1(operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid:=(auth.jwt()->>'session_id')::uuid; deadline timestamptz; t timestamptz;
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF operation IS NULL OR operation NOT IN ('status','extend') OR sid IS NULL OR auth.uid() IS NULL
 THEN RAISE insufficient_privilege; END IF;
 IF operation='extend' THEN PERFORM pg_advisory_xact_lock(hashtextextended(sid::text,0)); END IF;
 deadline:=oaz_admin_clock.deadline(); t:=clock_timestamp();
 IF deadline IS NULL THEN RAISE insufficient_privilege; END IF;
 IF deadline<=t THEN RETURN jsonb_build_object('state','expired','expiresAt',deadline,'serverNow',t,'sessionId',sid); END IF;
 PERFORM oaz_final.actor(false);
 IF oaz_enrollment.allowed() IS NOT TRUE OR oaz_password.live_session() IS NOT TRUE THEN RAISE insufficient_privilege; END IF;
 IF operation='extend' THEN
  INSERT INTO oaz_admin_clock.extensions VALUES(sid,auth.uid(),t);
  deadline:=t+interval '30 minutes';
 END IF;
 RETURN jsonb_build_object('state','active','expiresAt',deadline,'serverNow',t,'sessionId',sid);
END$$;
REVOKE ALL ON FUNCTION public.oaz_admin_clock_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.oaz_admin_clock_v1(text) TO authenticated;
-- In Main, the existing 004 insert gate requires a current, actor-bound permit.
-- For direct image staging only allow ordinary authenticated POST uploads.
-- Signed URL issuance must not confer write capability beyond the session deadline.
DO $$BEGIN
 IF to_regprocedure('storage.allow_only_operation(text)') IS NULL OR NOT EXISTS(
   SELECT FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname='oaz_user_storage_insert_gate'
   AND polcmd='a' AND NOT polpermissive AND pg_get_expr(polwithcheck,polrelid)='oaz_user_storage.can_write(bucket_id, name)')
 THEN RAISE EXCEPTION 'STORAGE_INSERT_CONTRACT_REQUIRED'; END IF;
END$$;
CREATE POLICY oaz_admin_clock_image_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id NOT IN ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news') OR storage.allow_only_operation('object.upload'));
-- Some legacy administrative RPCs read the assignment directly. Enforce the same
-- deadline before dispatch, preserving non-administrator calls and service workflows.
CREATE FUNCTION oaz_gateway_v1.clock_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT FROM oaz_admin_v2.assignments a WHERE a.user_id=auth.uid())
 OR coalesce(oaz_admin_clock.deadline()>statement_timestamp(),false)
$$;
REVOKE ALL ON FUNCTION oaz_gateway_v1.clock_allowed() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION oaz_gateway_v1.clock_allowed() TO authenticated;
DO $gateway$
DECLARE f regprocedure:='public.oaz_gateway_v1(text,jsonb)'::regprocedure; p pg_proc; def text;
BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid=f;
 IF p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'0a43eaed019eec4428cf6eaf250e9fb998193c77cf8a00d6a5d34593b65ae6ae'
 THEN RAISE EXCEPTION 'ADMIN_GATEWAY_BASELINE_REQUIRED'; END IF;
 def:=pg_get_functiondef(f);
 -- Nested IF avoids execution privileges on this private helper for anon/service.
 EXECUTE replace(def,' CASE route',' IF current_user=''authenticated'' THEN IF NOT oaz_gateway_v1.clock_allowed() THEN RAISE insufficient_privilege; END IF; END IF; CASE route');
END $gateway$;
-- Expose the already translated title while 010 still has pending work on the body.
DO $meta$
DECLARE f regprocedure:='public.oaz_public_content_meta_v1(text,bigint)'::regprocedure;
 p pg_proc; def text; updated text;
BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid=f;
 IF NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'2d0d193027c8820aa014a094cb2ade2e05c4494a6ddaf1239bd35ca1165ed6b4'
 OR NOT EXISTS(SELECT FROM oaz_final.server_rpc_contract c JOIN pg_proc w ON w.oid=c.wrapper_oid
 WHERE c.original_oid=p.oid AND c.owner_oid=p.proowner AND c.original_settings IS NOT DISTINCT FROM p.proconfig
 AND c.original_sha256=encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')
 AND c.wrapper_sha256=encode(sha256(convert_to(w.prosrc,'UTF8')),'hex'))
 THEN RAISE EXCEPTION 'NOTICE_TITLE_CONTRACT_REQUIRED'; END IF;
 def:=pg_get_functiondef(f);
 updated:=replace(def,'''noticeEnglish'',true,''translationStatus''',
    '''noticeEnglish'',true,''fallbackTitle'',state->>''title'',''translationStatus''');
 IF updated=def THEN RAISE EXCEPTION 'NOTICE_TITLE_PROJECTION_REQUIRED'; END IF;
 EXECUTE updated;
 UPDATE oaz_final.server_rpc_contract SET original_sha256=encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid=f),'UTF8')),'hex') WHERE original_oid=f;
END $meta$;
DO $$BEGIN
 IF (SELECT count(*) FROM oaz_admin_clock.prior_definitions)<>4
 OR EXISTS(SELECT FROM oaz_admin_clock.prior_definitions b JOIN pg_proc p ON p.oid=b.signature::regprocedure
 WHERE b.proowner<>p.proowner OR b.proacl IS DISTINCT FROM p.proacl OR b.definition=pg_get_functiondef(p.oid))
 OR has_table_privilege('authenticated','oaz_admin_clock.extensions','INSERT')
 OR has_function_privilege('anon','public.oaz_admin_clock_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'ADMIN_CLOCK_POSTCHECK_FAILED'; END IF;
END$$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'OAZ_ADMIN_CLOCK_COMMITTED' AS result;
