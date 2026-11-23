-- After 004 only. Keep a RESTRICTIVE authenticated INSERT gate, replacing
-- obsolete supervisor_id visibility with the stricter scoped, expiring permit.
-- Anonymous INSERT and all UPDATE/DELETE denies remain unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=pg_catalog;
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('oaz.storage_bridge_review',true) IS DISTINCT FROM 'reviewed-v1'
 OR to_regprocedure('oaz_user_storage.can_write(text,text)') IS NULL
 OR NOT EXISTS(SELECT FROM oaz_release.staged_state WHERE id AND phase='contracted')
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='storage.objects'::regclass
   AND polname='oaz_guard_20261031_auth_insert' AND polcmd='a' AND NOT polpermissive
   AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
   AND md5(pg_get_expr(polwithcheck,polrelid))='fafe7531c2883076bfcdc8a34f72a61e')
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='storage.objects'::regclass
   AND polname='oaz_user_storage_insert_gate' AND polcmd='a' AND NOT polpermissive)
 THEN RAISE EXCEPTION 'LEGACY_STORAGE_BRIDGE_REVIEW_REQUIRED'; END IF;
END $$;
ALTER POLICY oaz_guard_20261031_auth_insert ON storage.objects
 WITH CHECK(oaz_user_storage.can_write(bucket_id,name));
COMMIT;
