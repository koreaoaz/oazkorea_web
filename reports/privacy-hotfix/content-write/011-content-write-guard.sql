-- 추가 후보 SQL. 기존 010 보호 SQL 적용 및 postcheck 이후에만 적용한다.
-- 현재는 검증된 로컬 fixture에서만 실행한다. 운영 적용 승인/대상 검증을 대체하지 않는다.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $guard$
DECLARE t text; c text; col text; rel regclass;
BEGIN
 IF current_setting('oaz.local_content_fixture',true) IS DISTINCT FROM 'oaz-privacy-local' THEN
  RAISE EXCEPTION 'CONTENT_STOP: explicit local fixture required';
 END IF;
 IF to_regprocedure('oaz_privacy_v3.content_editor()') IS NULL OR EXISTS(
  SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'CONTENT_STOP: prerequisite/role mismatch';
 END IF;
 FOREACH t IN ARRAY ARRAY['editor_0_noti','editor_1_projects','editor_2_studies',
  'editor_3_study_timetable','editor_4_schedules','editor_5_donators','editor_6_events'] LOOP
  rel:=to_regclass(format('public.%I',t));
  IF rel IS NULL OR NOT EXISTS(SELECT FROM pg_class WHERE oid=rel AND relkind='r' AND NOT relhasrules)
   OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND pg_has_role(oid,(SELECT relowner FROM pg_class WHERE oid=rel),'MEMBER')) THEN
   RAISE EXCEPTION 'CONTENT_STOP: table/owner mismatch';
  END IF;
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',rel);
  -- RLS를 우회하는 테이블 작업 및 익명 쓰기는 허용하지 않는다. 조회 ACL은 보존한다.
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON %s FROM PUBLIC,anon',rel);
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON %s FROM authenticated',rel);
  FOR col IN SELECT attname FROM pg_attribute WHERE attrelid=rel AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON %s FROM PUBLIC,anon',col,col,col,rel);
  END LOOP;
  -- permissive 정책은 OR로 합쳐지므로 추가 허용 정책만으로는 기존 USING(true)를 막을 수 없다.
  -- JWT의 사용자 메타데이터/클라이언트가 보내는 관리자 ID 대신 기존 DB 권한 함수를 사용한다.
  -- STABLE 함수는 문장 단위 평가이며 다음 요청에서 권한 회수가 즉시 반영된다.
  FOREACH c IN ARRAY ARRAY['insert','update','delete'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON %s','oaz_content_'||c,rel);
   IF c='insert' THEN
    EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT oaz_privacy_v3.content_editor()))','oaz_content_'||c,rel);
   ELSIF c='update' THEN
    EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT oaz_privacy_v3.content_editor())) WITH CHECK ((SELECT oaz_privacy_v3.content_editor()))','oaz_content_'||c,rel);
   ELSE
    EXECUTE format('CREATE POLICY %I ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT oaz_privacy_v3.content_editor()))','oaz_content_'||c,rel);
   END IF;
  END LOOP;
 END LOOP;
END $guard$;
NOTIFY pgrst,'reload schema';
COMMIT;
