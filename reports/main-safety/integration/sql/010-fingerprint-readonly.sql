-- Metadata only. No automatic Dashboard setting approval.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
-- Read-only metadata digest. Policy expressions stay inside PostgreSQL.
WITH targets AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN
 ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
), document AS (SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
   c.relowner::regrole::text,c.relacl::text) ORDER BY c.relname) FROM targets c),
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),
   a.attnotnull,a.attacl::text) ORDER BY c.relname,a.attnum) FROM targets c JOIN pg_attribute a
   ON a.attrelid=c.oid WHERE a.attnum>0 AND NOT a.attisdropped),
 'defaults_and_constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
   FROM targets c JOIN pg_attribute a ON a.attrelid=c.oid JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.contype,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname)
   FROM targets c JOIN pg_constraint k ON k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_indexdef(i.indexrelid),i.indisvalid) ORDER BY c.relname,i.indexrelid)
   FROM targets c JOIN pg_index i ON i.indrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY c.relname,t.tgname)
   FROM targets c JOIN pg_trigger t ON t.tgrelid=c.oid WHERE NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,
   pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY c.relname,p.polname)
   FROM targets c JOIN pg_policy p ON p.polrelid=c.oid),
 'public_policies',(SELECT jsonb_agg(jsonb_build_array(c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,
   pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY c.relname,p.polname)
   FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'views',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relowner::regrole::text,c.relacl::text,c.reloptions,
   encode(sha256(convert_to(pg_get_viewdef(c.oid),'UTF8')),'hex')) ORDER BY n.nspname,c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','graphql_public','graphql','extensions') AND c.relkind IN ('v','m')),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.proowner::regrole::text,
   p.prosecdef,p.proconfig,p.proacl::text,p.prorettype,p.proargtypes::text,p.provolatile,p.prokind,p.proisstrict,p.proleakproof,p.proparallel,encode(sha256(convert_to(coalesce(p.probin,'')||pg_get_function_arguments(p.oid),'UTF8')),'hex'),encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) ORDER BY p.oid::regprocedure::text)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth','graphql_public','graphql','extensions')),
 'roles',(SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls,rolinherit) ORDER BY rolname)
   FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
 'memberships',(SELECT jsonb_agg(jsonb_build_array(roleid::regrole::text,member::regrole::text,
   admin_option,inherit_option,set_option) ORDER BY roleid,member) FROM pg_auth_members),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(defaclrole::regrole::text,defaclnamespace,defaclobjtype,defaclacl::text)
   ORDER BY defaclrole,defaclnamespace,defaclobjtype) FROM pg_default_acl),
 'schema_acl',(SELECT jsonb_agg(jsonb_build_array(nspname,nspowner::regrole::text,nspacl::text) ORDER BY nspname)
   FROM pg_namespace WHERE nspname IN ('public','auth','graphql_public','graphql','extensions')) ,
 'extensions',(SELECT jsonb_agg(jsonb_build_array(e.extname,e.extversion,e.extowner::regrole::text,n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
 'api_relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner::regrole::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,encode(sha256(convert_to(coalesce(obj_description(c.oid,'pg_class'),''),'UTF8')),'hex')) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('graphql_public','graphql','extensions')),
 'api_schema_comments',(SELECT jsonb_agg(jsonb_build_array(nspname,encode(sha256(convert_to(coalesce(obj_description(oid,'pg_namespace'),''),'UTF8')),'hex')) ORDER BY nspname) FROM pg_namespace WHERE nspname IN ('public','graphql_public','graphql','extensions')),
 'event_triggers',(SELECT jsonb_agg(jsonb_build_array(evtname,evtevent,evtowner::regrole::text,evtenabled,evttags,evtfoid::regprocedure::text) ORDER BY evtname) FROM pg_event_trigger),
 'role_database_settings',(SELECT jsonb_agg(jsonb_build_array(setdatabase,setrole,encode(sha256(convert_to(setconfig::text,'UTF8')),'hex')) ORDER BY setdatabase,setrole) FROM pg_db_role_setting)
) AS value)
SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') AS catalog_sha256 FROM document;

ROLLBACK;
