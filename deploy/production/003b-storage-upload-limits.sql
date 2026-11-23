-- After contract, before 004. Preserves every existing object and object path.
-- Explicitly sets the reviewed future upload limit; does not resize/delete files.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('oaz.storage_limit_review',true) IS DISTINCT FROM 'reviewed-v1'
 OR NOT EXISTS(SELECT FROM oaz_release.staged_state WHERE id AND phase='contracted')
 OR (SELECT count(*) FROM storage.buckets WHERE id IN
 ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news') AND NOT public)<>6
 THEN RAISE EXCEPTION 'STORAGE_LIMIT_REVIEW_REQUIRED'; END IF;
END $$;
UPDATE storage.buckets SET file_size_limit=5242880 WHERE id IN
 ('oaz-final-image-staging','oaz-public-documents-staging','notice-images','project_img','study-images','card_news')
 AND file_size_limit IS DISTINCT FROM 5242880;
COMMIT;
