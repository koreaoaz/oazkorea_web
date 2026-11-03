-- OPTIONAL METADATA COLLECTION FOR A SEPARATELY APPROVED TEST PROJECT ONLY.
-- No connection or execution is performed by the application or CI workflow.
-- Do not infer project identity from this output; verify the target separately.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SELECT jsonb_build_object(
  'server_version_num', current_setting('server_version_num'),
  'auth_managed_objects_present', to_regclass('auth.users') IS NOT NULL AND to_regclass('auth.identities') IS NOT NULL,
  'storage_managed_objects_present', to_regclass('storage.objects') IS NOT NULL,
  'graphql_version', (SELECT extversion FROM pg_extension WHERE extname='pg_graphql'),
  'public_tables', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', c.relname, 'rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'policy_count', (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid),
    'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid,a.atttypmod), 'not_null', a.attnotnull) ORDER BY a.attnum),'[]'::jsonb)
      FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'api_roles', (SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,
      'any_select',has_any_column_privilege(r.oid,c.oid,'SELECT'),
      'insert',has_table_privilege(r.oid,c.oid,'INSERT'),
      'update',has_table_privilege(r.oid,c.oid,'UPDATE'),
      'delete',has_table_privilege(r.oid,c.oid,'DELETE')) ORDER BY r.rolname),'[]'::jsonb)
      FROM pg_roles r WHERE r.rolname IN ('anon','authenticated'))
    ) ORDER BY c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN (
      'registered_member','allowed_user','supervisor_id','who_is_boss','editor_0_noti','editor_1_projects',
      'editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_5_donators','editor_6_events','today_visitor')),
  'private_rpc_presence', jsonb_build_object(
    'session',to_regprocedure('public.oaz_privacy_session_v3()') IS NOT NULL,
    'directory',to_regprocedure('public.oaz_privacy_editor_list_v3(text)') IS NOT NULL,
    'donor',to_regprocedure('public.oaz_donor_write_v3(text,bigint,jsonb)') IS NOT NULL,
    'approval',to_regprocedure('public.oaz_approval_add_v3(text,text)') IS NOT NULL)
);
ROLLBACK;
