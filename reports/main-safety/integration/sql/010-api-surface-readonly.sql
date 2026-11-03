-- Future separately authorized metadata inspection only. No application rows or policy/function bodies.
-- Counts are review signals, NOT a GraphQL safety certificate or Dashboard-setting detector.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
WITH scopes AS (
 SELECT oid,nspname FROM pg_namespace
 WHERE nspname IN ('public','graphql_public','graphql','extensions','oaz_admin_v2','oaz_privacy_v3')
), roles AS (SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated'))
SELECT jsonb_build_object(
 'schema_role_inventory',(SELECT jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'role',r.rolname,
  'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
  'create',has_schema_privilege(r.oid,n.oid,'CREATE'),
  'relations_with_select',(SELECT count(*) FROM pg_class c WHERE c.relnamespace=n.oid
    AND c.relkind IN ('r','p','v','m','f') AND has_any_column_privilege(r.oid,c.oid,'SELECT')),
  'selectable_base_tables_without_rls',(SELECT count(*) FROM pg_class c WHERE c.relnamespace=n.oid
    AND c.relkind IN ('r','p') AND NOT c.relrowsecurity AND has_any_column_privilege(r.oid,c.oid,'SELECT')),
  'selectable_views',(SELECT count(*) FROM pg_class c WHERE c.relnamespace=n.oid
    AND c.relkind IN ('v','m') AND has_any_column_privilege(r.oid,c.oid,'SELECT')),
  'executable_definer_functions',(SELECT count(*) FROM pg_proc p WHERE p.pronamespace=n.oid
    AND p.prosecdef AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
 ) ORDER BY n.nspname,r.rolname) FROM scopes n CROSS JOIN roles r),
 'graphql_extension',(SELECT jsonb_build_object('version',e.extversion,'schema',n.nspname)
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_graphql'),
 'default_acl_inventory',(SELECT jsonb_agg(jsonb_build_object(
    'creator',d.defaclrole::regrole::text,'schema',coalesce(n.nspname,'GLOBAL'),
    'object_type',d.defaclobjtype,'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
    'privilege',a.privilege_type,'grantable',a.is_grantable)
    ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantee,a.privilege_type)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE (n.nspname='public' OR d.defaclnamespace=0)
    AND (a.grantee=0 OR a.grantee IN (SELECT oid FROM roles)))
) AS metadata_review_only;
ROLLBACK;
