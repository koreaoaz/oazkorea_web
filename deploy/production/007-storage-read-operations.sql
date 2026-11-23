-- NOT APPROVED FOR PRODUCTION. Requires explicit approval of this file hash.
-- Compatibility candidate: only the exact read-operation predicate changes.
-- Publication, role, MFA, scope, withdrawal, path and expiry checks remain intact.
-- No GRANT, policy/bucket change, object mutation, Auth change or deployment.
-- Hosted/CDN causality is not proven by the isolated provider test.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $review$
DECLARE d text; acl text; owner oid;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('oaz.storage_read_review',true) IS DISTINCT FROM 'approved-v1'
 OR NOT EXISTS(SELECT FROM oaz_release.staged_state WHERE id AND phase='contracted')
 OR NOT EXISTS(SELECT FROM oaz_cutover_guard.state WHERE id AND content_closed AND auth_closed)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass)
 OR (SELECT count(*) FROM storage.buckets WHERE id IN ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news') AND NOT public AND file_size_limit=5242880)<>6
 THEN RAISE EXCEPTION 'STORAGE_READ_REVIEW_OR_FENCE_REQUIRED'; END IF;
 SELECT pg_get_functiondef(p.oid),p.proacl::text,p.proowner INTO d,acl,owner
 FROM pg_proc p WHERE p.oid='oaz_user_storage.can_read(text,text)'::regprocedure;
 IF encode(sha256(convert_to(d,'UTF8')),'hex') IS DISTINCT FROM '5ff2d5773df8c6bcc6cbad8d78a158b6cb1764869d3a22543a949d93ff46da28'
 OR owner <> 'postgres'::regrole
 THEN RAISE EXCEPTION 'STORAGE_READ_DEFINITION_DRIFT'; END IF;
 EXECUTE replace(d,'storage.allow_only_operation(''object.get_authenticated'')','storage.allow_any_operation(ARRAY[''object.get_authenticated'',''object.get_authenticated_info'',''object.head_authenticated_info''])');
 IF (SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')<>'a5fd2c4b76dd91f939f40bc6f5827a813d1a10b3443bb057e71bbe740fcf811f'
 OR p.proacl::text IS DISTINCT FROM acl OR p.proowner<>owner OR NOT p.prosecdef
 FROM pg_proc p WHERE p.oid='oaz_user_storage.can_read(text,text)'::regprocedure)
 THEN RAISE EXCEPTION 'STORAGE_READ_POSTCHECK'; END IF;
END
$review$;
COMMIT;
