-- Reviewed successor, AFTER staged contract. No role token or RLS bypass.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('oaz.user_storage_review',true) IS DISTINCT FROM 'reviewed-v1'
 OR to_regnamespace('oaz_user_storage') IS NOT NULL
 OR to_regprocedure('public.oaz_gateway_v1(text,jsonb)') IS NULL
 OR to_regprocedure('storage.allow_only_operation(text)') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass)
 OR (SELECT count(*) FROM storage.buckets WHERE id IN ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news') AND NOT public AND file_size_limit=5242880)<>6
 OR NOT EXISTS(SELECT FROM oaz_admin_v2.state WHERE id AND content_ready)
 OR EXISTS(SELECT FROM storage.buckets WHERE id IN ('notice-images','project_img','study-images','card_news') AND public)
 OR NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='oaz_media_direct_insert_deny' AND permissive='RESTRICTIVE' AND with_check='false')
 THEN RAISE EXCEPTION 'USER_STORAGE_REVIEW_REQUIRED';END IF;
END$$;
CREATE SCHEMA oaz_user_storage;
REVOKE ALL ON SCHEMA oaz_user_storage FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE oaz_user_storage.permits(
 bucket text NOT NULL,path text NOT NULL,kind text NOT NULL CHECK(kind IN ('raw','image','pdf')),
 actor uuid NOT NULL,session_id uuid NOT NULL,expires timestamptz NOT NULL,
 PRIMARY KEY(bucket,path));
ALTER TABLE oaz_user_storage.permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oaz_user_storage.permits FROM PUBLIC,anon,authenticated,service_role;

-- Only a validated user plus the server gate may grant an immutable path permit.
-- Original actor checks enforce current enrollment, session, role, MFA and scope.
CREATE FUNCTION public.oaz_storage_gateway_v1(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a oaz_admin_v2.assignments;t oaz_media_v1.tickets;d oaz_final.attachments;
 act text:=command->>'action';kind text:=command->>'kind';p text:=command->>'path';
 sid uuid:=(auth.jwt()->>'session_id')::uuid;
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF auth.role() IS DISTINCT FROM 'authenticated' OR jsonb_typeof(command) IS DISTINCT FROM 'object'
 OR octet_length(command::text)>2048 OR EXISTS(SELECT FROM jsonb_object_keys(command) k WHERE k NOT IN ('action','kind','path','id'))
 THEN RAISE insufficient_privilege;END IF;
 PERFORM 1 FROM oaz_admin_v2.state WHERE id AND content_ready FOR SHARE;
 IF NOT FOUND THEN RAISE insufficient_privilege;END IF;
 a:=oaz_final.actor();
 IF act='permit' AND kind IN ('raw','image') THEN
  SELECT * INTO t FROM oaz_media_v1.tickets WHERE object_name=p;
  IF t.actor_id IS DISTINCT FROM a.user_id OR t.session_id IS DISTINCT FROM sid
  OR NOT public.oaz_media_can_store_v1('oaz-final-image-staging',p) THEN RAISE insufficient_privilege;END IF;
  INSERT INTO oaz_user_storage.permits VALUES('oaz-final-image-staging',p,kind,a.user_id,sid,t.created_at+interval '10 minutes');
  IF kind='image' THEN
   INSERT INTO oaz_user_storage.permits VALUES(t.bucket_id,p,kind,a.user_id,sid,t.created_at+interval '10 minutes');
  END IF;
 ELSIF act='permit' AND kind='pdf' THEN
  SELECT * INTO d FROM oaz_final.attachments WHERE id=(command->>'id')::uuid;
  IF d.actor_id IS DISTINCT FROM a.user_id OR d.session_id IS DISTINCT FROM sid
  OR NOT public.oaz_attachment_store_allowed_v1('oaz-public-documents-staging',d.object_name) THEN RAISE insufficient_privilege;END IF;
  INSERT INTO oaz_user_storage.permits VALUES('oaz-public-documents-staging',d.object_name,kind,a.user_id,sid,d.created_at+interval '5 minutes');
 ELSIF act='finish' AND kind='image' THEN
  SELECT * INTO t FROM oaz_media_v1.tickets WHERE object_name=p;
  IF t.actor_id IS DISTINCT FROM a.user_id OR t.session_id IS DISTINCT FROM sid
  OR NOT EXISTS(SELECT FROM oaz_user_storage.permits WHERE bucket=t.bucket_id AND path=p AND permits.kind='image' AND actor=a.user_id AND session_id=sid AND expires>statement_timestamp())
  THEN RAISE insufficient_privilege;END IF;
  RETURN to_jsonb(public.oaz_media_finish_v1(p));
 ELSIF act='finish' AND kind='pdf' THEN
  SELECT * INTO d FROM oaz_final.attachments WHERE id=(command->>'id')::uuid;
  IF d.actor_id IS DISTINCT FROM a.user_id OR d.session_id IS DISTINCT FROM sid
  OR NOT EXISTS(SELECT FROM oaz_user_storage.permits WHERE bucket='oaz-public-documents-staging' AND path=d.object_name AND permits.kind='pdf' AND actor=a.user_id AND session_id=sid AND expires>statement_timestamp())
  THEN RAISE insufficient_privilege;END IF;
  RETURN to_jsonb(public.oaz_attachment_finish_v1(d.id));
 ELSE RAISE insufficient_privilege;
 END IF;
 RETURN 'true'::jsonb;
END$$;
REVOKE ALL ON FUNCTION public.oaz_storage_gateway_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.oaz_storage_gateway_v1(jsonb) TO authenticated;

CREATE FUNCTION oaz_user_storage.can_write(b text,p text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a oaz_admin_v2.assignments;c oaz_user_storage.permits;
BEGIN
 a:=oaz_final.actor();
 SELECT * INTO c FROM oaz_user_storage.permits WHERE bucket=b AND path=p AND actor=a.user_id
 AND session_id=(auth.jwt()->>'session_id')::uuid AND expires>statement_timestamp();
 IF c.path IS NULL THEN RETURN false;END IF;
 RETURN CASE WHEN c.kind='pdf' THEN public.oaz_attachment_store_allowed_v1(b,p) ELSE public.oaz_media_can_store_v1(b,p) END;
EXCEPTION WHEN insufficient_privilege OR invalid_text_representation THEN RETURN false;
END$$;
CREATE FUNCTION oaz_user_storage.can_read(b text,p text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a oaz_admin_v2.assignments;doc uuid;
BEGIN
 -- SELECT also authorizes signing/listing in Storage. Permit only immediate
 -- authenticated download, so withdrawal cannot be bypassed by a durable URL.
 IF NOT storage.allow_only_operation('object.get_authenticated') THEN RETURN false;END IF;
 IF b='oaz-final-image-staging' THEN
  a:=oaz_final.actor();
  -- Normalized paths are never listed/read before finalization. Raw paths are
  -- quarantine-only; they cannot be published by the public finish operation.
  RETURN EXISTS(SELECT FROM oaz_user_storage.permits WHERE bucket=b AND path=p AND kind='raw'
   AND actor=a.user_id AND session_id=(auth.jwt()->>'session_id')::uuid AND expires>statement_timestamp())
   AND public.oaz_media_can_store_v1(b,p);
 ELSIF b='oaz-public-documents-staging' THEN
  SELECT id INTO doc FROM oaz_final.attachments WHERE object_name=p;
  IF doc IS NULL THEN RETURN false;END IF;
  IF public.oaz_attachment_access_v1(doc,false) IS NOT NULL THEN RETURN true;END IF;
  RETURN auth.uid() IS NOT NULL AND public.oaz_attachment_access_v1(doc,true) IS NOT NULL;
 ELSIF b IN ('notice-images','project_img','study-images','card_news') THEN
  IF oaz_acceptance.image_access(b,p,false) IS NOT NULL THEN RETURN true;END IF;
  RETURN auth.uid() IS NOT NULL AND oaz_acceptance.image_access(b,p,true) IS NOT NULL;
 END IF;
 RETURN false;
EXCEPTION WHEN insufficient_privilege OR invalid_text_representation THEN RETURN false;
END$$;
REVOKE ALL ON FUNCTION oaz_user_storage.can_write(text,text),oaz_user_storage.can_read(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA oaz_user_storage TO anon,authenticated;
GRANT EXECUTE ON FUNCTION oaz_user_storage.can_write(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION oaz_user_storage.can_read(text,text) TO anon,authenticated;
-- No permissive INSERT can override this authenticated-only restrictive gate.
-- The old anon deny remains; UPDATE/DELETE denies and enrollment fence remain.
ALTER POLICY oaz_media_direct_insert_deny ON storage.objects TO anon;
CREATE POLICY oaz_user_storage_insert_gate ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(oaz_user_storage.can_write(bucket_id,name));
CREATE POLICY oaz_user_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(oaz_user_storage.can_write(bucket_id,name));
CREATE POLICY oaz_user_storage_read ON storage.objects FOR SELECT TO anon,authenticated USING(oaz_user_storage.can_read(bucket_id,name));
CREATE POLICY oaz_user_storage_read_gate ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 CASE WHEN bucket_id IN ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news')
 THEN oaz_user_storage.can_read(bucket_id,name) ELSE true END);
COMMIT;
