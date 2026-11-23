-- Apply once, as the database owner, on the reviewed OAZ schema. No network calls.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
 IF to_regnamespace('oaz_notice_en') IS NOT NULL THEN RAISE EXCEPTION 'NOTICE_EN_ALREADY_INSTALLED'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='public.oaz_final_command_v1(jsonb)'::regprocedure)
     IS DISTINCT FROM '27cf3faa7ed58f23c0378d8ac615d7caa1793d9cd078c689d23f467c2ae0b004'
 OR NOT EXISTS (SELECT FROM pg_proc WHERE oid='public.oaz_public_content_meta_v1(text,bigint)'::regprocedure
     AND encode(sha256(convert_to(prosrc,'UTF8')),'hex') IN (
       '2f946baa3ba6544d3cabee568355b794403c80a3e7e56d8f78f3fe26a34fdceb', -- 042 CRLF
       '8fb064a6dc56cb5cc85a67710373673d7465e56cc2f37927c4fd63a14b4a277f')) -- 042 LF
 THEN RAISE EXCEPTION 'REVIEW_EXISTING_RPC_DEFINITIONS'; END IF;
 IF EXISTS(SELECT FROM pg_proc WHERE oid IN ('public.oaz_final_command_v1(jsonb)'::regprocedure,'public.oaz_public_content_meta_v1(text,bigint)'::regprocedure)
 AND pg_get_userbyid(proowner)<>current_user) THEN RAISE EXCEPTION 'RUN_AS_REVIEWED_RPC_OWNER'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='oaz_notice_translator' AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 THEN RAISE EXCEPTION 'INCOMPATIBLE_WORKER_ROLE'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='oaz_notice_translator') THEN CREATE ROLE oaz_notice_translator NOLOGIN; END IF;
END $guard$;
CREATE SCHEMA oaz_notice_en;
REVOKE ALL ON SCHEMA oaz_notice_en FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE oaz_notice_en.fields (
 record_id bigint REFERENCES public.editor_0_noti(id) ON DELETE CASCADE,
 field text CHECK(field IN ('title','body')), source_hash text NOT NULL,
 english text, manual boolean NOT NULL DEFAULT false, attempts integer NOT NULL DEFAULT 0,
 lease uuid, due timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(record_id,field)
);
CREATE INDEX ON oaz_notice_en.fields(due) WHERE english IS NULL;
CREATE TABLE oaz_notice_en.history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, record_id bigint NOT NULL, field text NOT NULL,
 source_hash text NOT NULL, english text NOT NULL, manual boolean NOT NULL, promotion boolean NOT NULL, saved_at timestamptz NOT NULL
);
CREATE INDEX ON oaz_notice_en.history(record_id,id DESC);
ALTER TABLE oaz_notice_en.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE oaz_notice_en.history ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION oaz_notice_en.digest(t text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=''
AS $$ SELECT encode(sha256(convert_to(t,'UTF8')),'hex') $$;

-- Keep every accepted field value, including an automatically produced value before an edit.
CREATE FUNCTION oaz_notice_en.archive() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.english IS NOT NULL AND (TG_OP='INSERT' OR
 (NEW.english,NEW.source_hash,NEW.manual) IS DISTINCT FROM (OLD.english,OLD.source_hash,OLD.manual)) THEN
 INSERT INTO oaz_notice_en.history(record_id,field,source_hash,english,manual,promotion,saved_at)
 VALUES(NEW.record_id,NEW.field,NEW.source_hash,NEW.english,NEW.manual,(SELECT is_noti IS FALSE FROM public.editor_0_noti WHERE id=NEW.record_id),NEW.updated_at);
 END IF;RETURN NULL;
END $$;
CREATE TRIGGER archive_english AFTER INSERT OR UPDATE ON oaz_notice_en.fields FOR EACH ROW EXECUTE FUNCTION oaz_notice_en.archive();

CREATE FUNCTION oaz_notice_en.enqueue(rid bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src jsonb; reviewed oaz_final.translations;
BEGIN
 IF NOT oaz_site.visible('editor_0_noti',rid) THEN
   UPDATE oaz_notice_en.fields SET lease=NULL,due=now() WHERE record_id=rid AND lease IS NOT NULL;
 END IF;
 src:=oaz_final.public_text('editor_0_noti',rid);
 IF src IS NULL THEN RETURN; END IF;
 SELECT * INTO reviewed FROM oaz_final.translations WHERE table_name='editor_0_noti' AND record_id=rid AND source_hash=oaz_notice_en.digest(src::text);
 INSERT INTO oaz_notice_en.fields AS f(record_id,field,source_hash,english,manual)
 SELECT rid,k,oaz_notice_en.digest(coalesce(src->>k,'')),
 CASE WHEN reviewed.record_id IS NOT NULL THEN CASE k WHEN 'title' THEN reviewed.title_en ELSE reviewed.body_en END
 WHEN coalesce(src->>k,'') !~ '[^[:space:]]' THEN coalesce(src->>k,'') END,reviewed.record_id IS NOT NULL
 FROM unnest(ARRAY['body','title']) AS k
 ON CONFLICT(record_id,field) DO UPDATE SET source_hash=excluded.source_hash,english=excluded.english,
 manual=excluded.manual,lease=NULL,due=now(),attempts=0,updated_at=now()
 WHERE f.source_hash<>excluded.source_hash;
END $$;
CREATE FUNCTION oaz_notice_en.on_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='editor_0_noti' THEN PERFORM oaz_notice_en.enqueue(NEW.id);
 ELSIF TG_OP='DELETE' THEN IF OLD.table_name='editor_0_noti' THEN PERFORM oaz_notice_en.enqueue(OLD.record_id);END IF;
 ELSIF NEW.table_name='editor_0_noti' THEN PERFORM oaz_notice_en.enqueue(NEW.record_id); END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER notice_english_source AFTER INSERT OR UPDATE OF text,description ON public.editor_0_noti FOR EACH ROW EXECUTE FUNCTION oaz_notice_en.on_source();
CREATE TRIGGER notice_english_visibility AFTER INSERT OR UPDATE OR DELETE ON oaz_site.visibility FOR EACH ROW EXECUTE FUNCTION oaz_notice_en.on_source();

CREATE FUNCTION oaz_notice_en.manual_save() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src jsonb;
BEGIN
 IF NEW.table_name<>'editor_0_noti' THEN RETURN NULL; END IF;
 src:=oaz_final.public_text(NEW.table_name,NEW.record_id);
 IF NEW.source_hash IS DISTINCT FROM oaz_notice_en.digest(src::text) THEN RAISE EXCEPTION 'SOURCE_CONFLICT' USING ERRCODE='PT409'; END IF;
 INSERT INTO oaz_notice_en.fields AS f(record_id,field,source_hash,english,manual)
 SELECT NEW.record_id,k,oaz_notice_en.digest(coalesce(src->>k,'')),CASE k WHEN 'title' THEN NEW.title_en ELSE NEW.body_en END,true
 FROM unnest(ARRAY['body','title']) AS k
 ON CONFLICT(record_id,field) DO UPDATE SET source_hash=excluded.source_hash,english=excluded.english,
 manual=true,attempts=0,lease=NULL,due=now(),updated_at=now()
 WHERE (f.english,f.source_hash) IS DISTINCT FROM (excluded.english,excluded.source_hash);
 RETURN NULL;
END $$;
CREATE TRIGGER notice_english_manual AFTER INSERT OR UPDATE ON oaz_final.translations FOR EACH ROW EXECUTE FUNCTION oaz_notice_en.manual_save();

CREATE FUNCTION oaz_notice_en.claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f oaz_notice_en.fields; src jsonb;
BEGIN
 SELECT q.* INTO f FROM oaz_notice_en.fields q WHERE q.english IS NULL AND q.due<=clock_timestamp()
 AND oaz_site.visible('editor_0_noti',q.record_id) ORDER BY q.due,q.record_id,q.field LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 src:=oaz_final.public_text('editor_0_noti',f.record_id);
 IF f.source_hash IS DISTINCT FROM oaz_notice_en.digest(coalesce(src->>f.field,'')) THEN RETURN NULL; END IF;
 UPDATE oaz_notice_en.fields SET lease=gen_random_uuid(),due=now()+interval '10 minutes',attempts=attempts+1
 WHERE record_id=f.record_id AND field=f.field RETURNING * INTO f;
 RETURN jsonb_build_object('id',f.record_id,'field',f.field,'hash',f.source_hash,'source',src->>f.field,
   'revisionHash',oaz_notice_en.digest(src::text),'lease',f.lease);
END $$;
CREATE FUNCTION oaz_notice_en.finish(rid bigint,k text,h text,token uuid,result text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF result IS NOT NULL AND (btrim(result)='' OR length(result)>(CASE WHEN k='title' THEN 500 ELSE 40000 END)) THEN RAISE EXCEPTION 'INVALID_TRANSLATION';END IF;
 UPDATE oaz_notice_en.fields SET english=result, lease=NULL, updated_at=now(),
 due=now()+make_interval(secs=>least(1800,5*(1<<least(attempts,8))))
 WHERE record_id=rid AND field=k AND source_hash=h AND lease=token AND english IS NULL AND NOT manual
 AND oaz_site.visible('editor_0_noti',rid)
 AND h=oaz_notice_en.digest(coalesce(oaz_final.public_text('editor_0_noti',rid)->>k,''));
 RETURN FOUND;
END $$;

-- Preserve the reviewed implementations as private delegates. Public function OIDs,
-- callers, owners and ACLs are retained by CREATE OR REPLACE below.
DO $$DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.oaz_final_command_v1(jsonb)'::regprocedure,'public.oaz_public_content_meta_v1(text,bigint)'::regprocedure] LOOP
 EXECUTE replace(pg_get_functiondef(f),'CREATE OR REPLACE FUNCTION public.','CREATE FUNCTION oaz_notice_en.');
 END LOOP;
END $$;
CREATE FUNCTION oaz_notice_en.status(rid bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('status',CASE WHEN count(*)<>2 THEN 'pending'
 WHEN bool_or(english IS NULL AND attempts>0 AND lease IS NULL) THEN 'retry'
 WHEN count(english)<2 THEN 'pending' WHEN bool_or(manual) THEN 'reviewed' ELSE 'automatic' END,
 'updatedAt',max(updated_at),'title',max(english) FILTER(WHERE field='title'),'body',max(english) FILTER(WHERE field='body'))
 FROM oaz_notice_en.fields WHERE record_id=rid
$$;
CREATE OR REPLACE FUNCTION public.oaz_public_content_meta_v1(tbl text,rid bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE meta jsonb; state jsonb;
BEGIN
 meta:=oaz_notice_en.oaz_public_content_meta_v1(tbl,rid);
 IF meta IS NULL OR tbl<>'editor_0_noti' THEN RETURN meta;END IF;
 state:=oaz_notice_en.status(rid);
 RETURN meta || jsonb_build_object('noticeEnglish',true,'translationStatus',state->>'status','translation',
 CASE WHEN state->>'status' IN ('reviewed','automatic') THEN jsonb_build_object('title',state->>'title','body',state->>'body') END);
END $$;
CREATE OR REPLACE FUNCTION public.oaz_final_command_v1(command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE act text:=command->>'action'; rid bigint; state jsonb; result jsonb; src jsonb;
BEGIN
 IF command->>'table' IS DISTINCT FROM 'editor_0_noti' THEN RETURN oaz_notice_en.oaz_final_command_v1(command);END IF;
 IF act='translation.list' THEN
  PERFORM oaz_final.actor();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id DESC) FROM
   (SELECT n.id,n.text AS korean, s->>'title' AS english,s->>'updatedAt' AS updated,
    CASE WHEN oaz_site.visible('editor_0_noti',n.id) THEN s->>'status' ELSE 'private' END AS status
    FROM public.editor_0_noti n CROSS JOIN LATERAL oaz_notice_en.status(n.id) s
    WHERE oaz_final.can_edit('editor_0_noti',n.is_noti IS FALSE) AND (command->>'id' IS NULL OR n.id<(command->>'id')::bigint)
    ORDER BY n.id DESC LIMIT 50) item),'[]'::jsonb);
 END IF;
 IF act NOT IN ('translation.get','translation.save') THEN RETURN oaz_notice_en.oaz_final_command_v1(command);END IF;
 rid:=(command->>'id')::bigint;
 IF act='translation.save' THEN
  IF NOT EXISTS(SELECT FROM public.editor_0_noti n WHERE n.id=rid AND oaz_final.can_edit('editor_0_noti',n.is_noti IS FALSE)) THEN RAISE insufficient_privilege; END IF;
  -- Use the same assignment lock order as the existing content writer.
  PERFORM 1 FROM oaz_admin_v2.state WHERE id FOR UPDATE;
  PERFORM 1 FROM public.editor_0_noti WHERE id=rid FOR UPDATE;
  IF nullif(btrim(command->>'body'),'') IS NULL AND coalesce(oaz_final.public_text('editor_0_noti',rid)->>'body','') ~ '[^[:space:]]' THEN RAISE invalid_parameter_value; END IF;
 END IF;
 result:=oaz_notice_en.oaz_final_command_v1(command);
 IF act='translation.get' THEN
  state:=oaz_notice_en.status(rid);
  RETURN result || jsonb_build_object('title',state->>'title','body',state->>'body','status',state->>'status','updatedAt',state->>'updatedAt','history',
   coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id DESC) FROM (SELECT id,field,english,source_hash,saved_at,manual FROM oaz_notice_en.history WHERE record_id=rid AND oaz_final.can_edit('editor_0_noti',promotion) ORDER BY id DESC LIMIT 100) h),'[]'::jsonb));
 END IF;
 RETURN result;
END $$;
-- Preserve grants on existing RPCs. No new web-facing RPC or table grant.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA oaz_notice_en FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA oaz_notice_en FROM PUBLIC,anon,authenticated,service_role,oaz_notice_translator;
GRANT USAGE ON SCHEMA oaz_notice_en TO oaz_notice_translator;
GRANT EXECUTE ON FUNCTION oaz_notice_en.claim(),oaz_notice_en.finish(bigint,text,text,uuid,text) TO oaz_notice_translator;
-- Existing reviewed rows retain their English. The worker first checks approved,
-- source-matched local cache entries for remaining rows.
SELECT oaz_notice_en.enqueue(n.id) FROM public.editor_0_noti n;
UPDATE oaz_final.server_rpc_contract c SET original_sha256=encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')
FROM pg_proc p WHERE c.original_oid=p.oid AND p.oid IN ('public.oaz_final_command_v1(jsonb)'::regprocedure,'public.oaz_public_content_meta_v1(text,bigint)'::regprocedure);
NOTIFY pgrst,'reload schema';
COMMIT;
