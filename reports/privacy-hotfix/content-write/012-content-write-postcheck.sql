-- 읽기 전용 사후 검사. 기존 010-postcheck도 별도로 함께 통과해야 한다.
DO $check$
DECLARE t text; rel regclass; p record; expected text;
BEGIN
 FOREACH t IN ARRAY ARRAY['editor_0_noti','editor_1_projects','editor_2_studies',
  'editor_3_study_timetable','editor_4_schedules','editor_5_donators','editor_6_events'] LOOP
  rel:=to_regclass(format('public.%I',t));
  IF rel IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=rel) THEN
   RAISE EXCEPTION 'CONTENT_STOP: RLS missing';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid=rel AND polname IN ('oaz_content_insert','oaz_content_update','oaz_content_delete'))<>3 THEN
   RAISE EXCEPTION 'CONTENT_STOP: policy missing';
  END IF;
  FOR p IN SELECT * FROM pg_policy WHERE polrelid=rel AND polname IN ('oaz_content_insert','oaz_content_update','oaz_content_delete') LOOP
   expected:='( SELECT oaz_privacy_v3.content_editor() AS content_editor)';
   IF p.polpermissive OR p.polroles<>ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[] OR
    p.polcmd::text<>(CASE p.polname WHEN 'oaz_content_insert' THEN 'a' WHEN 'oaz_content_update' THEN 'w' ELSE 'd' END) OR
    (p.polcmd<>'a' AND regexp_replace(pg_get_expr(p.polqual,p.polrelid),'\s+',' ','g') IS DISTINCT FROM expected) OR
    (p.polcmd<>'d' AND regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'\s+',' ','g') IS DISTINCT FROM expected) THEN
    RAISE EXCEPTION 'CONTENT_STOP: policy contract mismatch';
   END IF;
  END LOOP;
  IF has_table_privilege('anon',rel,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR
   has_any_column_privilege('anon',rel,'INSERT') OR has_any_column_privilege('anon',rel,'UPDATE') OR
   has_table_privilege('authenticated',rel,'TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') THEN
   RAISE EXCEPTION 'CONTENT_STOP: ACL bypass';
  END IF;
 END LOOP;
END $check$;
SELECT 'LOCAL_CONTENT_WRITE_POSTCHECK_PASS';
