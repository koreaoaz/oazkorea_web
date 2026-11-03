-- P0 v3.1 API-guarded candidate: public OR public+graphql_public. Historical 001/010 drafts must not be combined.
-- Actual GraphQL engine/wrapper checks and fresh catalog seal required. Never misdeclare Dashboard settings.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $privacy3_api$
DECLARE scopes jsonb; extra_paths jsonb; auto_tables text; wrapper oid; ext oid;
        engine text; source_hash text; lang text; api_role text; ns record; f record;
        installed boolean:=false; expected_version text; expected_wrapper text; paused boolean:=false;
BEGIN
 PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
 IF to_regclass('oaz_privacy_v3.api_contract') IS NOT NULL THEN
  installed:=true;
  EXECUTE 'SELECT settings->''schemas'',settings->''extra_paths'',settings->>''auto_tables'',graphql_version,graphql_wrapper_sha FROM oaz_privacy_v3.api_contract WHERE id'
    INTO scopes,extra_paths,auto_tables,expected_version,expected_wrapper;
  EXECUTE 'SELECT coalesce((settings->>''graphql_paused'')::boolean,false) FROM oaz_privacy_v3.api_contract WHERE id' INTO paused;
 ELSE
  scopes:=nullif(current_setting('oaz.privacy_exposed_schemas',true),'')::jsonb;
  extra_paths:=nullif(current_setting('oaz.privacy_extra_search_path',true),'')::jsonb;
  auto_tables:=current_setting('oaz.privacy_auto_expose_new_tables',true);
 END IF;
 IF installed AND (expected_version IS DISTINCT FROM (SELECT extversion FROM pg_extension WHERE extname='pg_graphql') OR
    expected_wrapper IS DISTINCT FROM (SELECT encode(sha256(convert_to(regexp_replace(prosrc,'\s','','g'),'UTF8')),'hex')
      FROM pg_proc WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)'))) THEN
  RAISE EXCEPTION 'P0_STOP: GraphQL implementation drift from installed API contract';
 END IF;
 IF scopes IS NULL OR scopes NOT IN ('["public"]'::jsonb,'["public","graphql_public"]'::jsonb,
                                   '["graphql_public","public"]'::jsonb) OR
    extra_paths IS DISTINCT FROM '["public","extensions"]'::jsonb OR
    auto_tables IS NULL OR auto_tables NOT IN ('on','off') THEN
  RAISE EXCEPTION 'P0_STOP: unsupported or unattested API schemas/search path/automatic-grant mode';
 END IF;
 IF to_regnamespace('extensions') IS NULL THEN
  RAISE EXCEPTION 'P0_STOP: declared extra search-path namespace missing';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOR ns IN SELECT oid,nspowner FROM pg_namespace WHERE nspname IN ('graphql_public','graphql','extensions') LOOP
   IF has_schema_privilege(api_role,ns.oid,'CREATE') OR pg_has_role(api_role,ns.nspowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: API role can modify or own GraphQL/extra-path schema';
   END IF;
  END LOOP;
  -- Extra-path invoker functions may forge GUC claims too. Only reviewed stock C extensions
  -- are admitted; event-trigger functions cannot be called as SQL RPC.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='extensions' AND p.prorettype<>'event_trigger'::regtype
    AND has_function_privilege(api_role,p.oid,'EXECUTE') AND
     (p.prosecdef OR p.proconfig IS NOT NULL OR l.lanname<>'c' OR NOT EXISTS(
      SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass
       AND d.deptype='e' AND e.extnamespace=n.oid AND e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements')
       AND p.probin='$libdir/'||e.extname))) OR
     EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('graphql_public','extensions') AND c.relkind IN ('r','p','v','m','f')
      AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT (
       n.nspname='extensions' AND c.relkind='v' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
       AND coalesce(obj_description(c.oid,'pg_class'),'') NOT LIKE '%@graphql%'
       AND EXISTS(SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
         WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
          AND d.deptype='e' AND e.extname='pg_stat_statements' AND e.extnamespace=n.oid))) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed extra-path function/relation or reflected statistics view';
  END IF;
 END LOOP;
 IF to_regnamespace('graphql_public') IS NULL THEN
  IF scopes ? 'graphql_public' THEN RAISE EXCEPTION 'P0_STOP: declared GraphQL wrapper schema missing'; END IF;
  RETURN;
 END IF;
 wrapper:=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)');
 IF wrapper IS NULL THEN RAISE EXCEPTION 'P0_STOP: standard GraphQL wrapper missing'; END IF;
 SELECT encode(sha256(convert_to(regexp_replace(p.prosrc,'\s','','g'),'UTF8')),'hex'),l.lanname
   INTO source_hash,lang FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=wrapper
   AND NOT p.prosecdef AND p.proconfig IS NULL AND p.prorettype='jsonb'::regtype AND p.prokind='f'
   AND p.proargnames=ARRAY['operationName','query','variables','extensions'] AND p.pronargdefaults=4
   AND pg_get_expr(p.proargdefaults,0)='NULL::text, NULL::text, NULL::jsonb, NULL::jsonb';
 IF source_hash IS NULL THEN RAISE EXCEPTION 'P0_STOP: unsafe GraphQL wrapper signature or definer'; END IF;
 -- Exact reviewed inactive placeholder from the existing metadata backup. Not proof of current live state.
 IF source_hash='5a5a0d33767d2f238cba56551d9a9cccd8299228e1113cf21a44ab6932e78935' AND lang='plpgsql' THEN
  engine:='inactive-placeholder';
 ELSIF lang='sql' AND regexp_replace((SELECT prosrc FROM pg_proc WHERE oid=wrapper),'\s','','g')=
   $canonical$selectgraphql.resolve(query:=query,variables:=coalesce(variables,'{}'),"operationName":="operationName",extensions:=extensions);$canonical$ THEN
  engine:='active';
 ELSE RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL wrapper implementation'; END IF;
 SELECT oid INTO ext FROM pg_extension WHERE extname='pg_graphql' AND extnamespace=to_regnamespace('graphql');
 IF engine='active' AND (ext IS NULL OR
     (SELECT extversion FROM pg_extension WHERE oid=ext) IS DISTINCT FROM '1.6.3' OR
     to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)') IS NULL) THEN
  RAISE EXCEPTION 'P0_STOP: tested pg_graphql 1.6.3 resolver required for active GraphQL';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF NOT has_schema_privilege(api_role,'graphql_public','USAGE') OR
     has_function_privilege(api_role,wrapper,'EXECUTE') IS DISTINCT FROM NOT paused OR
     pg_has_role(api_role,(SELECT proowner FROM pg_proc WHERE oid=wrapper),'MEMBER') THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL wrapper role contract mismatch';
  END IF;
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace=to_regnamespace('graphql_public') AND p.oid<>wrapper
    AND has_function_privilege(api_role,p.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed callable GraphQL entry point';
  END IF;
  IF engine='active' AND (NOT has_schema_privilege(api_role,'graphql','USAGE') OR
     NOT has_function_privilege(api_role,'graphql.resolve(text,jsonb,text,jsonb)','EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL resolver role contract mismatch';
  END IF;
  IF engine='active' AND (SELECT count(*) FROM pg_proc WHERE oid IN (
      to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql._internal_resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql.get_schema_version()'),to_regprocedure('graphql.comment_directive(text)'),
      to_regprocedure('graphql.exception(text)')) AND has_function_privilege(api_role,oid,'EXECUTE'))<>5 THEN
   RAISE EXCEPTION 'P0_STOP: required GraphQL invoker helper missing or inaccessible';
  END IF;
  FOR f IN SELECT p.*,l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.pronamespace=to_regnamespace('graphql') AND has_function_privilege(api_role,p.oid,'EXECUTE') LOOP
   IF ext IS NULL OR NOT EXISTS(SELECT FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND
        d.objid=f.oid AND d.refclassid='pg_extension'::regclass AND d.refobjid=ext AND d.deptype='e') OR
      pg_has_role(api_role,f.proowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: untrusted callable GraphQL helper';
   END IF;
   IF f.proconfig IS NOT NULL THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL helper session configuration';
   END IF;
   -- Extension membership/version alone does not prove that CREATE OR REPLACE has
   -- not modified an invoker helper to forge claims before evaluating RLS.
   IF NOT (
    (f.proname IN ('resolve','_internal_resolve') AND f.proargtypes::text='25 3802 25 3802'
      AND f.prorettype='jsonb'::regtype AND NOT f.prosecdef AND f.pronargdefaults=3
      AND pg_get_expr(f.proargdefaults,0)=$defaults$'{}'::jsonb, NULL::text, NULL::jsonb$defaults$
      AND ((f.proname='resolve' AND f.lanname='plpgsql' AND
       encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='5f2016655bcc50eb0d22087bc49c86c603e1ddb7ddc8b24f4f85722fecb6580d') OR
       (f.proname='_internal_resolve' AND f.lanname='c' AND f.prosrc='resolve_wrapper'))) OR
    (f.proname='comment_directive' AND f.proargtypes::text='25' AND f.prorettype='jsonb'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='c8646a880cb08b35e8b840a5ad53c979df72c4a0678c77ff986d4eae7dadfa9e') OR
    (f.proname='exception' AND f.proargtypes::text='25' AND f.prorettype='text'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='9fb58f6e8de1fc604314a290b52a1ab0aceed60c48e10b55088efb50c7133611') OR
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')
   ) THEN RAISE EXCEPTION 'P0_STOP: GraphQL helper implementation/defaults not in tested contract'; END IF;
   IF f.lanname='c' AND f.probin IS DISTINCT FROM '$libdir/pg_graphql' THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL native library';
   END IF;
   IF f.prosecdef AND NOT (
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL SECURITY DEFINER helper';
   END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_class c WHERE c.relnamespace=to_regnamespace('graphql') AND c.relkind IN ('r','p','v','m','f')
    AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT EXISTS(SELECT FROM pg_depend d
      WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
        AND d.refobjid=ext AND d.deptype='e')) THEN
   RAISE EXCEPTION 'P0_STOP: non-extension GraphQL relation bypass';
  END IF;
 END LOOP;
END $privacy3_api$;
DO $privacy3_preflight$
DECLARE observed text; expected text; entry record; role_name text;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  IF current_setting('oaz.approve_privacy_v3',true) IS DISTINCT FROM 'yes' OR
     current_setting('oaz.privacy_surface_review_approved',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'P0_STOP: deployment and API surface approval required';
  END IF;
  -- API schemas, GraphQL implementation, search path and automatic-grant declarations
  -- are validated by the stronger shared 010-api-guard.sql block assembled above.
  expected:=current_setting('oaz.privacy_expected_catalog_sha256',true);
  IF expected IS NULL OR expected!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'P0_STOP: privately reviewed current catalog fingerprint required';
  END IF;
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
SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') INTO observed FROM document;
  IF observed<>expected THEN RAISE EXCEPTION 'P0_STOP: catalog drift since approved snapshot'; END IF;
  IF EXISTS(SELECT FROM pg_namespace WHERE nspname='oaz_privacy_v3') THEN
    RAISE EXCEPTION 'P0_STOP: already installed; no overwrite/replay';
  END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'P0_STOP: reviewed BYPASSRLS function owner required';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3 OR
    EXISTS(SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) OR
    pg_has_role('authenticated','anon','MEMBER') OR pg_has_role('anon','authenticated','MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: unexpected API roles';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
      ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
      AND c.relkind='r' AND c.relrowsecurity AND NOT c.relhasrules)<>5 THEN
    RAISE EXCEPTION 'P0_STOP: expected RLS base tables not confirmed';
  END IF;
  FOR entry IN SELECT * FROM (VALUES
    ('registered_member',ARRAY['id','created_at','name','department','student_id','generation','uuid','email','phone_number','is_manager']),
    ('allowed_user',ARRAY['id','email','name']),('supervisor_id',ARRAY['id','name','email','created_at','uuid']),
    ('who_is_boss',ARRAY['id','created_at','uuid','name']),('editor_5_donators',ARRAY['id','name','uuid','created_at','date'])
  ) c(table_name,columns) LOOP
    IF (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute
        WHERE attrelid=format('public.%I',entry.table_name)::regclass AND attnum>0 AND NOT attisdropped)
      IS DISTINCT FROM (SELECT array_agg(v ORDER BY v) FROM unnest(entry.columns) v) THEN
      RAISE EXCEPTION 'P0_STOP: reviewed private column contract changed';
    END IF;
  END LOOP;
  -- Scoped DEFINER reads must not silently supersede an unknown old restrictive SELECT.
  IF NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.registered_member'::regclass AND i.indisunique AND i.indisvalid
    AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname='uuid') THEN
    RAISE EXCEPTION 'P0_STOP: existing unique member UUID contract required; no automatic data repair';
  END IF;
  IF EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relname IN
    ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators') AND a.attnum>0 AND NOT a.attisdropped
    AND ((a.attname IN ('name','email','department','generation','student_id','phone_number') AND t.typcategory<>'S') OR
      (a.attname='uuid' AND a.atttypid<>2950 AND t.typbasetype<>2950) OR
      (a.attname='id' AND a.atttypid NOT IN (20,21,23)) OR (a.attname='is_manager' AND a.atttypid<>16) OR
      (c.relname='editor_5_donators' AND a.attname='date' AND t.typcategory NOT IN ('S','D')))) THEN
    RAISE EXCEPTION 'P0_STOP: reviewed projection or identity data types changed';
  END IF;
  IF EXISTS(SELECT FROM pg_policy WHERE polrelid IN
    ('public.registered_member'::regclass,'public.allowed_user'::regclass,'public.who_is_boss'::regclass,'public.supervisor_id'::regclass,'public.editor_5_donators'::regclass)
    AND NOT polpermissive AND polcmd IN ('r','*')) THEN
    RAISE EXCEPTION 'P0_STOP: existing restrictive identity/donor SELECT needs separate review';
  END IF;
  IF EXISTS(SELECT FROM pg_inherits i JOIN pg_class c ON c.oid IN (i.inhrelid,i.inhparent)
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN
    ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')) THEN
    RAISE EXCEPTION 'P0_STOP: inheritance requires separate privacy review';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_database_privilege(role_name,current_database(),'CREATE') OR pg_has_role(role_name,current_user,'MEMBER') OR
      has_schema_privilege(role_name,'public','CREATE') OR has_schema_privilege(role_name,'auth','CREATE') OR
      EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
        AND c.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
        AND pg_has_role(role_name,c.relowner,'MEMBER')) THEN
      RAISE EXCEPTION 'P0_STOP: API schema creation or table-owner privilege';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='auth.users'::regclass AND NOT attisdropped
      AND attname IN ('id','email','email_confirmed_at','banned_until','deleted_at'))<>5 THEN
    RAISE EXCEPTION 'P0_STOP: Auth eligibility contract not confirmed';
  END IF;
  -- Any caller-visible owner-rights dependent view/materialized view is a blocker.
  IF EXISTS(WITH RECURSIVE dependent(oid) AS (
    SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
      (n.nspname='auth' AND c.relname='users') OR (n.nspname='public'
      AND c.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'))
    UNION SELECT r.ev_class FROM dependent x JOIN pg_depend d ON d.refobjid=x.oid AND d.refclassid='pg_class'::regclass
      JOIN pg_rewrite r ON r.oid=d.objid AND d.classid='pg_rewrite'::regclass)
    SELECT FROM dependent x JOIN pg_class c ON c.oid=x.oid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('v','m')
    AND EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
      AND has_schema_privilege(r.oid,n.oid,'USAGE') AND
      (has_table_privilege(r.oid,c.oid,'SELECT') OR has_any_column_privilege(r.oid,c.oid,'SELECT')))) THEN
    RAISE EXCEPTION 'P0_STOP: caller-visible owner-rights dependent view';
  END IF;
  -- Only the privately reviewed backup visitor function may pre-exist as public RPC.
  -- Hash metadata is compared internally; no body/name/owner/policy text is printed.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.prokind='f' AND EXISTS(SELECT FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
    AND NOT (p.proname='increment_visit' AND pg_get_function_identity_arguments(p.oid)='row_id integer'
      AND l.lanname='plpgsql' AND p.prosecdef AND
      encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
      'dbb32070d8f8347144f952cf3794fd54a0ecd1a5b5b2663c277a0a845a865efb')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed caller-visible public function';
  END IF;

  IF to_regnamespace('oaz_privacy_v2') IS NOT NULL THEN
    RAISE EXCEPTION 'P0_STOP: historical candidate installed; separate upgrade required';
  END IF;
  -- Existing signup/content policy subqueries must work with the new column ACL.
  -- Own-row expressions do not need a separate SELECT grant on their attributes.
  IF EXISTS(SELECT FROM pg_policy p JOIN pg_class owner_table ON owner_table.oid=p.polrelid
    JOIN pg_namespace ns ON ns.oid=owner_table.relnamespace
    JOIN pg_depend d ON d.classid='pg_policy'::regclass AND d.objid=p.oid AND d.refclassid='pg_class'::regclass
    JOIN pg_class referenced ON referenced.oid=d.refobjid
    JOIN pg_namespace rn ON rn.oid=referenced.relnamespace
    JOIN pg_attribute a ON a.attrelid=referenced.oid AND a.attnum=d.refobjsubid
    WHERE ns.nspname='public' AND rn.nspname='public' AND p.polrelid<>referenced.oid
    AND referenced.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
    AND NOT ((referenced.relname IN ('registered_member','supervisor_id') AND a.attname='uuid') OR
      (referenced.relname='allowed_user' AND a.attname='email') OR
      (referenced.relname='editor_5_donators' AND a.attname IN ('id','name')))) THEN
    RAISE EXCEPTION 'P0_STOP: existing policy depends on a newly restricted foreign column';
  END IF;
END $privacy3_preflight$;
LOCK TABLE public.registered_member,public.allowed_user,public.supervisor_id,public.who_is_boss,public.editor_5_donators IN ACCESS EXCLUSIVE MODE;
DO $privacy3_api$
DECLARE scopes jsonb; extra_paths jsonb; auto_tables text; wrapper oid; ext oid;
        engine text; source_hash text; lang text; api_role text; ns record; f record;
        installed boolean:=false; expected_version text; expected_wrapper text; paused boolean:=false;
BEGIN
 PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
 IF to_regclass('oaz_privacy_v3.api_contract') IS NOT NULL THEN
  installed:=true;
  EXECUTE 'SELECT settings->''schemas'',settings->''extra_paths'',settings->>''auto_tables'',graphql_version,graphql_wrapper_sha FROM oaz_privacy_v3.api_contract WHERE id'
    INTO scopes,extra_paths,auto_tables,expected_version,expected_wrapper;
  EXECUTE 'SELECT coalesce((settings->>''graphql_paused'')::boolean,false) FROM oaz_privacy_v3.api_contract WHERE id' INTO paused;
 ELSE
  scopes:=nullif(current_setting('oaz.privacy_exposed_schemas',true),'')::jsonb;
  extra_paths:=nullif(current_setting('oaz.privacy_extra_search_path',true),'')::jsonb;
  auto_tables:=current_setting('oaz.privacy_auto_expose_new_tables',true);
 END IF;
 IF installed AND (expected_version IS DISTINCT FROM (SELECT extversion FROM pg_extension WHERE extname='pg_graphql') OR
    expected_wrapper IS DISTINCT FROM (SELECT encode(sha256(convert_to(regexp_replace(prosrc,'\s','','g'),'UTF8')),'hex')
      FROM pg_proc WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)'))) THEN
  RAISE EXCEPTION 'P0_STOP: GraphQL implementation drift from installed API contract';
 END IF;
 IF scopes IS NULL OR scopes NOT IN ('["public"]'::jsonb,'["public","graphql_public"]'::jsonb,
                                   '["graphql_public","public"]'::jsonb) OR
    extra_paths IS DISTINCT FROM '["public","extensions"]'::jsonb OR
    auto_tables IS NULL OR auto_tables NOT IN ('on','off') THEN
  RAISE EXCEPTION 'P0_STOP: unsupported or unattested API schemas/search path/automatic-grant mode';
 END IF;
 IF to_regnamespace('extensions') IS NULL THEN
  RAISE EXCEPTION 'P0_STOP: declared extra search-path namespace missing';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOR ns IN SELECT oid,nspowner FROM pg_namespace WHERE nspname IN ('graphql_public','graphql','extensions') LOOP
   IF has_schema_privilege(api_role,ns.oid,'CREATE') OR pg_has_role(api_role,ns.nspowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: API role can modify or own GraphQL/extra-path schema';
   END IF;
  END LOOP;
  -- Extra-path invoker functions may forge GUC claims too. Only reviewed stock C extensions
  -- are admitted; event-trigger functions cannot be called as SQL RPC.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='extensions' AND p.prorettype<>'event_trigger'::regtype
    AND has_function_privilege(api_role,p.oid,'EXECUTE') AND
     (p.prosecdef OR p.proconfig IS NOT NULL OR l.lanname<>'c' OR NOT EXISTS(
      SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass
       AND d.deptype='e' AND e.extnamespace=n.oid AND e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements')
       AND p.probin='$libdir/'||e.extname))) OR
     EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('graphql_public','extensions') AND c.relkind IN ('r','p','v','m','f')
      AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT (
       n.nspname='extensions' AND c.relkind='v' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
       AND coalesce(obj_description(c.oid,'pg_class'),'') NOT LIKE '%@graphql%'
       AND EXISTS(SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
         WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
          AND d.deptype='e' AND e.extname='pg_stat_statements' AND e.extnamespace=n.oid))) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed extra-path function/relation or reflected statistics view';
  END IF;
 END LOOP;
 IF to_regnamespace('graphql_public') IS NULL THEN
  IF scopes ? 'graphql_public' THEN RAISE EXCEPTION 'P0_STOP: declared GraphQL wrapper schema missing'; END IF;
  RETURN;
 END IF;
 wrapper:=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)');
 IF wrapper IS NULL THEN RAISE EXCEPTION 'P0_STOP: standard GraphQL wrapper missing'; END IF;
 SELECT encode(sha256(convert_to(regexp_replace(p.prosrc,'\s','','g'),'UTF8')),'hex'),l.lanname
   INTO source_hash,lang FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=wrapper
   AND NOT p.prosecdef AND p.proconfig IS NULL AND p.prorettype='jsonb'::regtype AND p.prokind='f'
   AND p.proargnames=ARRAY['operationName','query','variables','extensions'] AND p.pronargdefaults=4
   AND pg_get_expr(p.proargdefaults,0)='NULL::text, NULL::text, NULL::jsonb, NULL::jsonb';
 IF source_hash IS NULL THEN RAISE EXCEPTION 'P0_STOP: unsafe GraphQL wrapper signature or definer'; END IF;
 -- Exact reviewed inactive placeholder from the existing metadata backup. Not proof of current live state.
 IF source_hash='5a5a0d33767d2f238cba56551d9a9cccd8299228e1113cf21a44ab6932e78935' AND lang='plpgsql' THEN
  engine:='inactive-placeholder';
 ELSIF lang='sql' AND regexp_replace((SELECT prosrc FROM pg_proc WHERE oid=wrapper),'\s','','g')=
   $canonical$selectgraphql.resolve(query:=query,variables:=coalesce(variables,'{}'),"operationName":="operationName",extensions:=extensions);$canonical$ THEN
  engine:='active';
 ELSE RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL wrapper implementation'; END IF;
 SELECT oid INTO ext FROM pg_extension WHERE extname='pg_graphql' AND extnamespace=to_regnamespace('graphql');
 IF engine='active' AND (ext IS NULL OR
     (SELECT extversion FROM pg_extension WHERE oid=ext) IS DISTINCT FROM '1.6.3' OR
     to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)') IS NULL) THEN
  RAISE EXCEPTION 'P0_STOP: tested pg_graphql 1.6.3 resolver required for active GraphQL';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF NOT has_schema_privilege(api_role,'graphql_public','USAGE') OR
     has_function_privilege(api_role,wrapper,'EXECUTE') IS DISTINCT FROM NOT paused OR
     pg_has_role(api_role,(SELECT proowner FROM pg_proc WHERE oid=wrapper),'MEMBER') THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL wrapper role contract mismatch';
  END IF;
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace=to_regnamespace('graphql_public') AND p.oid<>wrapper
    AND has_function_privilege(api_role,p.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed callable GraphQL entry point';
  END IF;
  IF engine='active' AND (NOT has_schema_privilege(api_role,'graphql','USAGE') OR
     NOT has_function_privilege(api_role,'graphql.resolve(text,jsonb,text,jsonb)','EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL resolver role contract mismatch';
  END IF;
  IF engine='active' AND (SELECT count(*) FROM pg_proc WHERE oid IN (
      to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql._internal_resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql.get_schema_version()'),to_regprocedure('graphql.comment_directive(text)'),
      to_regprocedure('graphql.exception(text)')) AND has_function_privilege(api_role,oid,'EXECUTE'))<>5 THEN
   RAISE EXCEPTION 'P0_STOP: required GraphQL invoker helper missing or inaccessible';
  END IF;
  FOR f IN SELECT p.*,l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.pronamespace=to_regnamespace('graphql') AND has_function_privilege(api_role,p.oid,'EXECUTE') LOOP
   IF ext IS NULL OR NOT EXISTS(SELECT FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND
        d.objid=f.oid AND d.refclassid='pg_extension'::regclass AND d.refobjid=ext AND d.deptype='e') OR
      pg_has_role(api_role,f.proowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: untrusted callable GraphQL helper';
   END IF;
   IF f.proconfig IS NOT NULL THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL helper session configuration';
   END IF;
   -- Extension membership/version alone does not prove that CREATE OR REPLACE has
   -- not modified an invoker helper to forge claims before evaluating RLS.
   IF NOT (
    (f.proname IN ('resolve','_internal_resolve') AND f.proargtypes::text='25 3802 25 3802'
      AND f.prorettype='jsonb'::regtype AND NOT f.prosecdef AND f.pronargdefaults=3
      AND pg_get_expr(f.proargdefaults,0)=$defaults$'{}'::jsonb, NULL::text, NULL::jsonb$defaults$
      AND ((f.proname='resolve' AND f.lanname='plpgsql' AND
       encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='5f2016655bcc50eb0d22087bc49c86c603e1ddb7ddc8b24f4f85722fecb6580d') OR
       (f.proname='_internal_resolve' AND f.lanname='c' AND f.prosrc='resolve_wrapper'))) OR
    (f.proname='comment_directive' AND f.proargtypes::text='25' AND f.prorettype='jsonb'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='c8646a880cb08b35e8b840a5ad53c979df72c4a0678c77ff986d4eae7dadfa9e') OR
    (f.proname='exception' AND f.proargtypes::text='25' AND f.prorettype='text'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='9fb58f6e8de1fc604314a290b52a1ab0aceed60c48e10b55088efb50c7133611') OR
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')
   ) THEN RAISE EXCEPTION 'P0_STOP: GraphQL helper implementation/defaults not in tested contract'; END IF;
   IF f.lanname='c' AND f.probin IS DISTINCT FROM '$libdir/pg_graphql' THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL native library';
   END IF;
   IF f.prosecdef AND NOT (
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL SECURITY DEFINER helper';
   END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_class c WHERE c.relnamespace=to_regnamespace('graphql') AND c.relkind IN ('r','p','v','m','f')
    AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT EXISTS(SELECT FROM pg_depend d
      WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
        AND d.refobjid=ext AND d.deptype='e')) THEN
   RAISE EXCEPTION 'P0_STOP: non-extension GraphQL relation bypass';
  END IF;
 END LOOP;
END $privacy3_api$;
DO $privacy3_preflight$
DECLARE observed text; expected text; entry record; role_name text;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  IF current_setting('oaz.approve_privacy_v3',true) IS DISTINCT FROM 'yes' OR
     current_setting('oaz.privacy_surface_review_approved',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'P0_STOP: deployment and API surface approval required';
  END IF;
  -- API schemas, GraphQL implementation, search path and automatic-grant declarations
  -- are validated by the stronger shared 010-api-guard.sql block assembled above.
  expected:=current_setting('oaz.privacy_expected_catalog_sha256',true);
  IF expected IS NULL OR expected!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'P0_STOP: privately reviewed current catalog fingerprint required';
  END IF;
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
SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') INTO observed FROM document;
  IF observed<>expected THEN RAISE EXCEPTION 'P0_STOP: catalog drift since approved snapshot'; END IF;
  IF EXISTS(SELECT FROM pg_namespace WHERE nspname='oaz_privacy_v3') THEN
    RAISE EXCEPTION 'P0_STOP: already installed; no overwrite/replay';
  END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'P0_STOP: reviewed BYPASSRLS function owner required';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3 OR
    EXISTS(SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) OR
    pg_has_role('authenticated','anon','MEMBER') OR pg_has_role('anon','authenticated','MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: unexpected API roles';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
      ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
      AND c.relkind='r' AND c.relrowsecurity AND NOT c.relhasrules)<>5 THEN
    RAISE EXCEPTION 'P0_STOP: expected RLS base tables not confirmed';
  END IF;
  FOR entry IN SELECT * FROM (VALUES
    ('registered_member',ARRAY['id','created_at','name','department','student_id','generation','uuid','email','phone_number','is_manager']),
    ('allowed_user',ARRAY['id','email','name']),('supervisor_id',ARRAY['id','name','email','created_at','uuid']),
    ('who_is_boss',ARRAY['id','created_at','uuid','name']),('editor_5_donators',ARRAY['id','name','uuid','created_at','date'])
  ) c(table_name,columns) LOOP
    IF (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute
        WHERE attrelid=format('public.%I',entry.table_name)::regclass AND attnum>0 AND NOT attisdropped)
      IS DISTINCT FROM (SELECT array_agg(v ORDER BY v) FROM unnest(entry.columns) v) THEN
      RAISE EXCEPTION 'P0_STOP: reviewed private column contract changed';
    END IF;
  END LOOP;
  -- Scoped DEFINER reads must not silently supersede an unknown old restrictive SELECT.
  IF NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.registered_member'::regclass AND i.indisunique AND i.indisvalid
    AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname='uuid') THEN
    RAISE EXCEPTION 'P0_STOP: existing unique member UUID contract required; no automatic data repair';
  END IF;
  IF EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relname IN
    ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators') AND a.attnum>0 AND NOT a.attisdropped
    AND ((a.attname IN ('name','email','department','generation','student_id','phone_number') AND t.typcategory<>'S') OR
      (a.attname='uuid' AND a.atttypid<>2950 AND t.typbasetype<>2950) OR
      (a.attname='id' AND a.atttypid NOT IN (20,21,23)) OR (a.attname='is_manager' AND a.atttypid<>16) OR
      (c.relname='editor_5_donators' AND a.attname='date' AND t.typcategory NOT IN ('S','D')))) THEN
    RAISE EXCEPTION 'P0_STOP: reviewed projection or identity data types changed';
  END IF;
  IF EXISTS(SELECT FROM pg_policy WHERE polrelid IN
    ('public.registered_member'::regclass,'public.allowed_user'::regclass,'public.who_is_boss'::regclass,'public.supervisor_id'::regclass,'public.editor_5_donators'::regclass)
    AND NOT polpermissive AND polcmd IN ('r','*')) THEN
    RAISE EXCEPTION 'P0_STOP: existing restrictive identity/donor SELECT needs separate review';
  END IF;
  IF EXISTS(SELECT FROM pg_inherits i JOIN pg_class c ON c.oid IN (i.inhrelid,i.inhparent)
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN
    ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')) THEN
    RAISE EXCEPTION 'P0_STOP: inheritance requires separate privacy review';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_database_privilege(role_name,current_database(),'CREATE') OR pg_has_role(role_name,current_user,'MEMBER') OR
      has_schema_privilege(role_name,'public','CREATE') OR has_schema_privilege(role_name,'auth','CREATE') OR
      EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
        AND c.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
        AND pg_has_role(role_name,c.relowner,'MEMBER')) THEN
      RAISE EXCEPTION 'P0_STOP: API schema creation or table-owner privilege';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='auth.users'::regclass AND NOT attisdropped
      AND attname IN ('id','email','email_confirmed_at','banned_until','deleted_at'))<>5 THEN
    RAISE EXCEPTION 'P0_STOP: Auth eligibility contract not confirmed';
  END IF;
  -- Any caller-visible owner-rights dependent view/materialized view is a blocker.
  IF EXISTS(WITH RECURSIVE dependent(oid) AS (
    SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
      (n.nspname='auth' AND c.relname='users') OR (n.nspname='public'
      AND c.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'))
    UNION SELECT r.ev_class FROM dependent x JOIN pg_depend d ON d.refobjid=x.oid AND d.refclassid='pg_class'::regclass
      JOIN pg_rewrite r ON r.oid=d.objid AND d.classid='pg_rewrite'::regclass)
    SELECT FROM dependent x JOIN pg_class c ON c.oid=x.oid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('v','m')
    AND EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
      AND has_schema_privilege(r.oid,n.oid,'USAGE') AND
      (has_table_privilege(r.oid,c.oid,'SELECT') OR has_any_column_privilege(r.oid,c.oid,'SELECT')))) THEN
    RAISE EXCEPTION 'P0_STOP: caller-visible owner-rights dependent view';
  END IF;
  -- Only the privately reviewed backup visitor function may pre-exist as public RPC.
  -- Hash metadata is compared internally; no body/name/owner/policy text is printed.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.prokind='f' AND EXISTS(SELECT FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
    AND NOT (p.proname='increment_visit' AND pg_get_function_identity_arguments(p.oid)='row_id integer'
      AND l.lanname='plpgsql' AND p.prosecdef AND
      encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
      'dbb32070d8f8347144f952cf3794fd54a0ecd1a5b5b2663c277a0a845a865efb')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed caller-visible public function';
  END IF;

  IF to_regnamespace('oaz_privacy_v2') IS NOT NULL THEN
    RAISE EXCEPTION 'P0_STOP: historical candidate installed; separate upgrade required';
  END IF;
  -- Existing signup/content policy subqueries must work with the new column ACL.
  -- Own-row expressions do not need a separate SELECT grant on their attributes.
  IF EXISTS(SELECT FROM pg_policy p JOIN pg_class owner_table ON owner_table.oid=p.polrelid
    JOIN pg_namespace ns ON ns.oid=owner_table.relnamespace
    JOIN pg_depend d ON d.classid='pg_policy'::regclass AND d.objid=p.oid AND d.refclassid='pg_class'::regclass
    JOIN pg_class referenced ON referenced.oid=d.refobjid
    JOIN pg_namespace rn ON rn.oid=referenced.relnamespace
    JOIN pg_attribute a ON a.attrelid=referenced.oid AND a.attnum=d.refobjsubid
    WHERE ns.nspname='public' AND rn.nspname='public' AND p.polrelid<>referenced.oid
    AND referenced.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
    AND NOT ((referenced.relname IN ('registered_member','supervisor_id') AND a.attname='uuid') OR
      (referenced.relname='allowed_user' AND a.attname='email') OR
      (referenced.relname='editor_5_donators' AND a.attname IN ('id','name')))) THEN
    RAISE EXCEPTION 'P0_STOP: existing policy depends on a newly restricted foreign column';
  END IF;
END $privacy3_preflight$;
SET LOCAL oaz.privacy_v3_assembly='verified-locked';
-- Build fragment, not standalone. Only 010-privacy-minimal.sql is deployable.
DO $$ BEGIN
 IF current_setting('oaz.privacy_v3_assembly',true) IS DISTINCT FROM 'verified-locked' OR
    current_setting('oaz.approve_privacy_v3',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'P0_STOP: build fragment cannot run standalone';
 END IF;
END $$;
CREATE SCHEMA oaz_privacy_v3;
REVOKE ALL ON SCHEMA oaz_privacy_v3 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA oaz_privacy_v3 TO authenticated;
CREATE TABLE oaz_privacy_v3.capabilities(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 capability text NOT NULL CHECK(capability IN
 ('members.read','approvals.read','donors.private.read','administrators.directory.read','approvals.write')),
 authority text NOT NULL CHECK(authority IN ('LEGACY','ADMIN_V2')),
 assignment_revision bigint,
 PRIMARY KEY(user_id,capability),
 CHECK((authority='LEGACY' AND assignment_revision IS NULL) OR
       (authority='ADMIN_V2' AND assignment_revision>=0 AND assignment_revision IS NOT NULL))
);
-- No INSERT: installation grants zero capabilities, even to admin1.
CREATE TABLE oaz_privacy_v3.state(id boolean PRIMARY KEY CHECK(id), donor_writes boolean NOT NULL,approval_writes boolean NOT NULL);
INSERT INTO oaz_privacy_v3.state VALUES(true,false,false);
CREATE TABLE oaz_privacy_v3.api_contract(id boolean PRIMARY KEY CHECK(id),settings jsonb NOT NULL,
 graphql_version text,graphql_wrapper_sha text);
INSERT INTO oaz_privacy_v3.api_contract
SELECT true,jsonb_build_object('schemas',current_setting('oaz.privacy_exposed_schemas')::jsonb,
 'extra_paths',current_setting('oaz.privacy_extra_search_path')::jsonb,
 'auto_tables',current_setting('oaz.privacy_auto_expose_new_tables')),
 (SELECT extversion FROM pg_extension WHERE extname='pg_graphql'),
 (SELECT encode(sha256(convert_to(regexp_replace(prosrc,'\s','','g'),'UTF8')),'hex') FROM pg_proc
  WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)'));
CREATE TABLE oaz_privacy_v3.acl_before AS
SELECT c.relname::text AS table_name,NULL::text AS column_name,a.*
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE n.nspname='public' AND c.relname IN
 ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators')
UNION ALL SELECT c.relname::text,t.attname::text,a.*
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute t ON t.attrelid=c.oid
 CROSS JOIN LATERAL aclexplode(t.attacl) a
WHERE n.nspname='public' AND c.relname IN
 ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['capabilities','state','acl_before','api_contract'] LOOP
  EXECUTE format('REVOKE ALL ON oaz_privacy_v3.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('ALTER TABLE oaz_privacy_v3.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE oaz_privacy_v3.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE FUNCTION oaz_privacy_v3.active_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL
   AND (banned_until IS NULL OR banned_until<=statement_timestamp()))
$$;
CREATE FUNCTION oaz_privacy_v3.legacy_editor() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE known boolean; enabled boolean;
BEGIN
 IF NOT oaz_privacy_v3.active_user() THEN RETURN false; END IF;
 IF to_regclass('oaz_admin_v2.assignments') IS NOT NULL THEN
  EXECUTE 'SELECT true,status=''active'' FROM oaz_admin_v2.assignments WHERE user_id=$1'
   INTO known,enabled USING auth.uid();
  IF known AND NOT enabled THEN RETURN false; END IF;
 END IF;
 RETURN EXISTS(SELECT FROM public.supervisor_id WHERE uuid=auth.uid());
END $$;
CREATE FUNCTION oaz_privacy_v3.content_editor() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE enabled boolean;
BEGIN
 IF NOT oaz_privacy_v3.active_user() THEN RETURN false; END IF;
 IF to_regclass('oaz_admin_v2.assignments') IS NOT NULL THEN
  EXECUTE 'SELECT status=''active'' AND role IN (''SUPER_ADMIN'',''ADMIN'') FROM oaz_admin_v2.assignments WHERE user_id=$1'
   INTO enabled USING auth.uid();
  IF enabled IS NOT NULL THEN RETURN enabled; END IF;
 END IF;
 RETURN oaz_privacy_v3.legacy_editor();
END $$;
CREATE FUNCTION oaz_privacy_v3.has_capability(wanted text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE g oaz_privacy_v3.capabilities; enabled boolean;
BEGIN
 IF NOT oaz_privacy_v3.active_user() THEN RETURN false; END IF;
 SELECT * INTO g FROM oaz_privacy_v3.capabilities WHERE user_id=auth.uid() AND capability=wanted;
 IF NOT FOUND THEN RETURN false; END IF;
 IF to_regclass('oaz_admin_v2.assignments') IS NOT NULL THEN
  IF g.authority<>'ADMIN_V2' THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS(SELECT FROM oaz_admin_v2.assignments WHERE user_id=$1 AND status=''active'' AND revision=$2 AND role IN (''SUPER_ADMIN'',''ADMIN''))'
   INTO enabled USING auth.uid(),g.assignment_revision;
  RETURN enabled;
 END IF;
 RETURN g.authority='LEGACY' AND oaz_privacy_v3.legacy_editor();
END $$;
CREATE FUNCTION oaz_privacy_v3.verified_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT email::text FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
  AND email=(auth.jwt()->>'email') AND oaz_privacy_v3.active_user()
$$;
CREATE FUNCTION oaz_privacy_v3.donor_writer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT oaz_privacy_v3.content_editor() AND oaz_privacy_v3.legacy_editor()
  AND EXISTS(SELECT FROM oaz_privacy_v3.state WHERE id AND donor_writes)
$$;
CREATE FUNCTION oaz_privacy_v3.approval_writer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT oaz_privacy_v3.has_capability('approvals.write') AND oaz_privacy_v3.legacy_editor()
 AND EXISTS(SELECT FROM oaz_privacy_v3.state WHERE id AND approval_writes)
 AND EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
  WHERE i.indrelid='public.allowed_user'::regclass AND i.indisunique AND i.indisvalid
   AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname='email')
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA oaz_privacy_v3 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA oaz_privacy_v3 TO authenticated;

-- Freeze all five direct projections. No future table column is granted implicitly.
DO $$ DECLARE t text; col name; BEGIN
 FOREACH t IN ARRAY ARRAY['registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'] LOOP
  EXECUTE format('REVOKE SELECT,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.%I FROM anon,authenticated',t);
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM anon',t);
  FOR col IN SELECT attname FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE SELECT(%I) ON public.%I FROM anon,authenticated',col,t);
   EXECUTE format('REVOKE INSERT(%I),UPDATE(%I) ON public.%I FROM anon',col,col,t);
  END LOOP;
 END LOOP;
END $$;
REVOKE INSERT ON public.registered_member FROM anon,authenticated;
DO $$ DECLARE col name; BEGIN
 FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.registered_member'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I) ON public.registered_member FROM anon,authenticated',col);
 END LOOP;
END $$;
GRANT INSERT(name,department,student_id,generation,phone_number,email,uuid,is_manager) ON public.registered_member TO authenticated;
-- pg_graphql pagination needs the primary key internally. RLS still restricts these
-- non-contact identifiers to the caller's own member/approval/legacy-admin row.
GRANT SELECT(id,uuid) ON public.registered_member,public.supervisor_id TO authenticated;
GRANT SELECT(id,email) ON public.allowed_user TO authenticated;
GRANT SELECT(id,name) ON public.editor_5_donators TO anon,authenticated;
REVOKE INSERT,UPDATE ON public.editor_5_donators FROM anon,authenticated;
DO $$ DECLARE col name; BEGIN
 FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.editor_5_donators'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I),UPDATE(%I) ON public.editor_5_donators FROM anon,authenticated',col,col);
 END LOOP;
END $$;
GRANT INSERT(name),UPDATE(name) ON public.editor_5_donators TO authenticated;
REVOKE UPDATE,DELETE ON public.registered_member FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.allowed_user,public.supervisor_id,public.who_is_boss FROM anon,authenticated;

DO $$ DECLARE col name; BEGIN
 FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.allowed_user'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I) ON public.allowed_user FROM anon,authenticated',col);
 END LOOP;
END $$;
GRANT INSERT(name,email) ON public.allowed_user TO authenticated;
CREATE POLICY privacy3_member_anon ON public.registered_member AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY privacy3_allowed_anon ON public.allowed_user AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY privacy3_member ON public.registered_member AS RESTRICTIVE FOR SELECT TO authenticated
 USING(uuid=auth.uid() AND oaz_privacy_v3.active_user());
CREATE POLICY privacy3_allowed ON public.allowed_user AS RESTRICTIVE FOR SELECT TO authenticated
 USING(email=oaz_privacy_v3.verified_email());
CREATE POLICY privacy3_supervisor ON public.supervisor_id AS RESTRICTIVE FOR SELECT TO authenticated
 USING(uuid=auth.uid() AND oaz_privacy_v3.legacy_editor());
CREATE POLICY privacy3_boss ON public.who_is_boss AS RESTRICTIVE FOR SELECT TO authenticated USING(false);
CREATE POLICY privacy3_signup ON public.registered_member AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(uuid=auth.uid() AND email=oaz_privacy_v3.verified_email() AND NOT is_manager
  AND EXISTS(SELECT FROM public.allowed_user WHERE email=oaz_privacy_v3.verified_email()));
-- Private account mutation is not implied by directory read or content editing.
DO $$ DECLARE t text; cmd text; BEGIN
 FOREACH t IN ARRAY ARRAY['registered_member','allowed_user','supervisor_id','who_is_boss'] LOOP
  FOREACH cmd IN ARRAY ARRAY['UPDATE','DELETE'] LOOP
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING(false)',
     'privacy3_block_'||t||'_'||lower(cmd),t,cmd);
  END LOOP;
  IF t='allowed_user' THEN
   CREATE POLICY privacy3_block_allowed_user_insert ON public.allowed_user AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK(oaz_privacy_v3.approval_writer());
  ELSIF t<>'registered_member' THEN
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false)',
     'privacy3_block_'||t||'_insert',t);
  END IF;
 END LOOP;
END $$;
CREATE POLICY privacy3_donor_insert ON public.editor_5_donators AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(oaz_privacy_v3.donor_writer());
CREATE POLICY privacy3_donor_update ON public.editor_5_donators AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(oaz_privacy_v3.donor_writer()) WITH CHECK(oaz_privacy_v3.donor_writer());
CREATE POLICY privacy3_donor_delete ON public.editor_5_donators AS RESTRICTIVE FOR DELETE TO authenticated
 USING(oaz_privacy_v3.donor_writer());

CREATE FUNCTION public.oaz_privacy_session_v3() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('schemaVersion',3,'capabilities',coalesce((SELECT jsonb_agg(capability ORDER BY capability)
  FROM oaz_privacy_v3.capabilities WHERE user_id=auth.uid() AND oaz_privacy_v3.has_capability(capability)),'[]'::jsonb),
  'donorWrite',oaz_privacy_v3.donor_writer(),'approvalWrite',oaz_privacy_v3.approval_writer())
$$;
CREATE FUNCTION public.oaz_member_self_v3() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT oaz_privacy_v3.active_user() THEN RAISE insufficient_privilege; END IF;
 SELECT jsonb_build_object('name',name,'department',department,'generation',generation)
  INTO STRICT result FROM public.registered_member WHERE uuid=auth.uid();
 RETURN result;
EXCEPTION WHEN no_data_found THEN RETURN NULL;
 WHEN too_many_rows THEN RAISE EXCEPTION 'Member profile ambiguous' USING ERRCODE='40001';
END $$;
CREATE FUNCTION public.oaz_privacy_editor_list_v3(board text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; fields text[];
BEGIN
 IF NOT oaz_privacy_v3.active_user() THEN RAISE insufficient_privilege; END IF;
 IF board='registered_member' THEN
  IF NOT oaz_privacy_v3.has_capability('members.read') THEN RAISE insufficient_privilege; END IF;
  fields:=ARRAY['name','department','generation'];
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'department',department,'generation',generation) ORDER BY id),'[]') INTO result FROM public.registered_member;
 ELSIF board='allowed_user' THEN
  IF NOT oaz_privacy_v3.has_capability('approvals.read') THEN RAISE insufficient_privilege; END IF;
  fields:=ARRAY['name','email'];
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email) ORDER BY id),'[]') INTO result FROM public.allowed_user;
 ELSIF board='supervisor_id' THEN
  IF NOT oaz_privacy_v3.has_capability('administrators.directory.read') THEN RAISE insufficient_privilege; END IF;
  fields:=ARRAY['name'];
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id),'[]') INTO result FROM public.supervisor_id;
 ELSIF board='editor_5_donators' THEN
  IF NOT oaz_privacy_v3.content_editor() THEN RAISE insufficient_privilege; END IF;
  IF oaz_privacy_v3.has_capability('donors.private.read') THEN
   fields:=ARRAY['name','date'];
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'date',date) ORDER BY id),'[]') INTO result FROM public.editor_5_donators;
  ELSE
   fields:=ARRAY['name'];
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id),'[]') INTO result FROM public.editor_5_donators;
  END IF;
 ELSE RAISE insufficient_privilege;
 END IF;
 RETURN jsonb_build_object('schemaVersion',3,'fields',fields,'rows',result);
END $$;
CREATE FUNCTION public.oaz_donor_write_v3(operation text,record_id bigint DEFAULT NULL,payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed_id bigint; changed_name text; affected bigint;
BEGIN
 IF NOT oaz_privacy_v3.donor_writer() THEN RAISE insufficient_privilege; END IF;
 IF operation IS NULL OR operation NOT IN ('create','update','delete') OR
  jsonb_typeof(payload) IS DISTINCT FROM 'object' OR
  EXISTS(SELECT FROM jsonb_object_keys(payload) k WHERE k<>'name') OR
  (operation<>'delete' AND (jsonb_typeof(payload->'name') IS DISTINCT FROM 'string' OR
   length(btrim(payload->>'name')) NOT BETWEEN 1 AND 200)) OR
  (operation<>'create' AND (record_id IS NULL OR record_id<1)) THEN
  RAISE EXCEPTION 'Invalid public donor command' USING ERRCODE='22023';
 END IF;
 IF operation='create' THEN
  INSERT INTO public.editor_5_donators(name) VALUES(btrim(payload->>'name')) RETURNING id,name INTO changed_id,changed_name;
 ELSIF operation='update' THEN
  UPDATE public.editor_5_donators SET name=btrim(payload->>'name') WHERE id=record_id RETURNING id,name INTO changed_id,changed_name;
 ELSE
  DELETE FROM public.editor_5_donators WHERE id=record_id RETURNING id,name INTO changed_id,changed_name;
 END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'No donor changed' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('id',changed_id,'name',changed_name);
END $$;
CREATE FUNCTION public.oaz_approval_add_v3(approval_name text,approval_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE affected bigint;
BEGIN
 IF NOT oaz_privacy_v3.approval_writer() THEN RAISE insufficient_privilege; END IF;
 IF approval_name IS NULL OR length(btrim(approval_name)) NOT BETWEEN 1 AND 200 OR approval_email IS NULL OR
  length(btrim(approval_email)) NOT BETWEEN 3 AND 320 OR btrim(approval_email)!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
  RAISE EXCEPTION 'Invalid approval input' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.allowed_user(name,email) VALUES(btrim(approval_name),btrim(approval_email));
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Approval unconfirmed' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('saved',true);
END $$;
REVOKE ALL ON FUNCTION public.oaz_privacy_session_v3(),public.oaz_member_self_v3(),
 public.oaz_privacy_editor_list_v3(text),public.oaz_donor_write_v3(text,bigint,jsonb),public.oaz_approval_add_v3(text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.oaz_privacy_session_v3(),public.oaz_member_self_v3(),
 public.oaz_privacy_editor_list_v3(text),public.oaz_donor_write_v3(text,bigint,jsonb),public.oaz_approval_add_v3(text,text) TO authenticated;
NOTIFY pgrst,'reload schema';


CREATE TABLE oaz_privacy_v3.guard_contract AS SELECT polrelid AS table_oid,polname AS policy_name,
 polcmd AS command,polroles AS roles,polqual::text AS using_tree,polwithcheck::text AS check_tree
 FROM pg_policy WHERE polname LIKE 'privacy3_%' AND polrelid IN
 ('public.registered_member'::regclass,'public.allowed_user'::regclass,'public.supervisor_id'::regclass,
  'public.who_is_boss'::regclass,'public.editor_5_donators'::regclass);
CREATE TABLE oaz_privacy_v3.function_contract AS SELECT p.oid AS function_oid,p.proowner AS owner_oid,
 p.prolang AS language_oid,p.prosecdef AS definer,p.proconfig AS settings,
 p.proargdefaults::text AS defaults_tree,p.proargnames AS argument_names,p.provolatile AS volatility,
 p.proisstrict AS strict,p.proleakproof AS leakproof,p.proparallel AS parallel,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='oaz_privacy_v3' OR
 (n.nspname='public' AND p.proname IN
 ('oaz_privacy_session_v3','oaz_member_self_v3','oaz_privacy_editor_list_v3','oaz_donor_write_v3','oaz_approval_add_v3'));
REVOKE ALL ON oaz_privacy_v3.guard_contract,oaz_privacy_v3.function_contract FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE oaz_privacy_v3.guard_contract ENABLE ROW LEVEL SECURITY;
ALTER TABLE oaz_privacy_v3.guard_contract FORCE ROW LEVEL SECURITY;
ALTER TABLE oaz_privacy_v3.function_contract ENABLE ROW LEVEL SECURITY;
ALTER TABLE oaz_privacy_v3.function_contract FORCE ROW LEVEL SECURITY;

DO $privacy3_api$
DECLARE scopes jsonb; extra_paths jsonb; auto_tables text; wrapper oid; ext oid;
        engine text; source_hash text; lang text; api_role text; ns record; f record;
        installed boolean:=false; expected_version text; expected_wrapper text; paused boolean:=false;
BEGIN
 PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
 IF to_regclass('oaz_privacy_v3.api_contract') IS NOT NULL THEN
  installed:=true;
  EXECUTE 'SELECT settings->''schemas'',settings->''extra_paths'',settings->>''auto_tables'',graphql_version,graphql_wrapper_sha FROM oaz_privacy_v3.api_contract WHERE id'
    INTO scopes,extra_paths,auto_tables,expected_version,expected_wrapper;
  EXECUTE 'SELECT coalesce((settings->>''graphql_paused'')::boolean,false) FROM oaz_privacy_v3.api_contract WHERE id' INTO paused;
 ELSE
  scopes:=nullif(current_setting('oaz.privacy_exposed_schemas',true),'')::jsonb;
  extra_paths:=nullif(current_setting('oaz.privacy_extra_search_path',true),'')::jsonb;
  auto_tables:=current_setting('oaz.privacy_auto_expose_new_tables',true);
 END IF;
 IF installed AND (expected_version IS DISTINCT FROM (SELECT extversion FROM pg_extension WHERE extname='pg_graphql') OR
    expected_wrapper IS DISTINCT FROM (SELECT encode(sha256(convert_to(regexp_replace(prosrc,'\s','','g'),'UTF8')),'hex')
      FROM pg_proc WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)'))) THEN
  RAISE EXCEPTION 'P0_STOP: GraphQL implementation drift from installed API contract';
 END IF;
 IF scopes IS NULL OR scopes NOT IN ('["public"]'::jsonb,'["public","graphql_public"]'::jsonb,
                                   '["graphql_public","public"]'::jsonb) OR
    extra_paths IS DISTINCT FROM '["public","extensions"]'::jsonb OR
    auto_tables IS NULL OR auto_tables NOT IN ('on','off') THEN
  RAISE EXCEPTION 'P0_STOP: unsupported or unattested API schemas/search path/automatic-grant mode';
 END IF;
 IF to_regnamespace('extensions') IS NULL THEN
  RAISE EXCEPTION 'P0_STOP: declared extra search-path namespace missing';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOR ns IN SELECT oid,nspowner FROM pg_namespace WHERE nspname IN ('graphql_public','graphql','extensions') LOOP
   IF has_schema_privilege(api_role,ns.oid,'CREATE') OR pg_has_role(api_role,ns.nspowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: API role can modify or own GraphQL/extra-path schema';
   END IF;
  END LOOP;
  -- Extra-path invoker functions may forge GUC claims too. Only reviewed stock C extensions
  -- are admitted; event-trigger functions cannot be called as SQL RPC.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='extensions' AND p.prorettype<>'event_trigger'::regtype
    AND has_function_privilege(api_role,p.oid,'EXECUTE') AND
     (p.prosecdef OR p.proconfig IS NOT NULL OR l.lanname<>'c' OR NOT EXISTS(
      SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass
       AND d.deptype='e' AND e.extnamespace=n.oid AND e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements')
       AND p.probin='$libdir/'||e.extname))) OR
     EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('graphql_public','extensions') AND c.relkind IN ('r','p','v','m','f')
      AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT (
       n.nspname='extensions' AND c.relkind='v' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
       AND coalesce(obj_description(c.oid,'pg_class'),'') NOT LIKE '%@graphql%'
       AND EXISTS(SELECT FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
         WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
          AND d.deptype='e' AND e.extname='pg_stat_statements' AND e.extnamespace=n.oid))) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed extra-path function/relation or reflected statistics view';
  END IF;
 END LOOP;
 IF to_regnamespace('graphql_public') IS NULL THEN
  IF scopes ? 'graphql_public' THEN RAISE EXCEPTION 'P0_STOP: declared GraphQL wrapper schema missing'; END IF;
  RETURN;
 END IF;
 wrapper:=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)');
 IF wrapper IS NULL THEN RAISE EXCEPTION 'P0_STOP: standard GraphQL wrapper missing'; END IF;
 SELECT encode(sha256(convert_to(regexp_replace(p.prosrc,'\s','','g'),'UTF8')),'hex'),l.lanname
   INTO source_hash,lang FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=wrapper
   AND NOT p.prosecdef AND p.proconfig IS NULL AND p.prorettype='jsonb'::regtype AND p.prokind='f'
   AND p.proargnames=ARRAY['operationName','query','variables','extensions'] AND p.pronargdefaults=4
   AND pg_get_expr(p.proargdefaults,0)='NULL::text, NULL::text, NULL::jsonb, NULL::jsonb';
 IF source_hash IS NULL THEN RAISE EXCEPTION 'P0_STOP: unsafe GraphQL wrapper signature or definer'; END IF;
 -- Exact reviewed inactive placeholder from the existing metadata backup. Not proof of current live state.
 IF source_hash='5a5a0d33767d2f238cba56551d9a9cccd8299228e1113cf21a44ab6932e78935' AND lang='plpgsql' THEN
  engine:='inactive-placeholder';
 ELSIF lang='sql' AND regexp_replace((SELECT prosrc FROM pg_proc WHERE oid=wrapper),'\s','','g')=
   $canonical$selectgraphql.resolve(query:=query,variables:=coalesce(variables,'{}'),"operationName":="operationName",extensions:=extensions);$canonical$ THEN
  engine:='active';
 ELSE RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL wrapper implementation'; END IF;
 SELECT oid INTO ext FROM pg_extension WHERE extname='pg_graphql' AND extnamespace=to_regnamespace('graphql');
 IF engine='active' AND (ext IS NULL OR
     (SELECT extversion FROM pg_extension WHERE oid=ext) IS DISTINCT FROM '1.6.3' OR
     to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)') IS NULL) THEN
  RAISE EXCEPTION 'P0_STOP: tested pg_graphql 1.6.3 resolver required for active GraphQL';
 END IF;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF NOT has_schema_privilege(api_role,'graphql_public','USAGE') OR
     has_function_privilege(api_role,wrapper,'EXECUTE') IS DISTINCT FROM NOT paused OR
     pg_has_role(api_role,(SELECT proowner FROM pg_proc WHERE oid=wrapper),'MEMBER') THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL wrapper role contract mismatch';
  END IF;
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace=to_regnamespace('graphql_public') AND p.oid<>wrapper
    AND has_function_privilege(api_role,p.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: unreviewed callable GraphQL entry point';
  END IF;
  IF engine='active' AND (NOT has_schema_privilege(api_role,'graphql','USAGE') OR
     NOT has_function_privilege(api_role,'graphql.resolve(text,jsonb,text,jsonb)','EXECUTE')) THEN
   RAISE EXCEPTION 'P0_STOP: GraphQL resolver role contract mismatch';
  END IF;
  IF engine='active' AND (SELECT count(*) FROM pg_proc WHERE oid IN (
      to_regprocedure('graphql.resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql._internal_resolve(text,jsonb,text,jsonb)'),
      to_regprocedure('graphql.get_schema_version()'),to_regprocedure('graphql.comment_directive(text)'),
      to_regprocedure('graphql.exception(text)')) AND has_function_privilege(api_role,oid,'EXECUTE'))<>5 THEN
   RAISE EXCEPTION 'P0_STOP: required GraphQL invoker helper missing or inaccessible';
  END IF;
  FOR f IN SELECT p.*,l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.pronamespace=to_regnamespace('graphql') AND has_function_privilege(api_role,p.oid,'EXECUTE') LOOP
   IF ext IS NULL OR NOT EXISTS(SELECT FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND
        d.objid=f.oid AND d.refclassid='pg_extension'::regclass AND d.refobjid=ext AND d.deptype='e') OR
      pg_has_role(api_role,f.proowner,'MEMBER') THEN
    RAISE EXCEPTION 'P0_STOP: untrusted callable GraphQL helper';
   END IF;
   IF f.proconfig IS NOT NULL THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL helper session configuration';
   END IF;
   -- Extension membership/version alone does not prove that CREATE OR REPLACE has
   -- not modified an invoker helper to forge claims before evaluating RLS.
   IF NOT (
    (f.proname IN ('resolve','_internal_resolve') AND f.proargtypes::text='25 3802 25 3802'
      AND f.prorettype='jsonb'::regtype AND NOT f.prosecdef AND f.pronargdefaults=3
      AND pg_get_expr(f.proargdefaults,0)=$defaults$'{}'::jsonb, NULL::text, NULL::jsonb$defaults$
      AND ((f.proname='resolve' AND f.lanname='plpgsql' AND
       encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='5f2016655bcc50eb0d22087bc49c86c603e1ddb7ddc8b24f4f85722fecb6580d') OR
       (f.proname='_internal_resolve' AND f.lanname='c' AND f.prosrc='resolve_wrapper'))) OR
    (f.proname='comment_directive' AND f.proargtypes::text='25' AND f.prorettype='jsonb'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='c8646a880cb08b35e8b840a5ad53c979df72c4a0678c77ff986d4eae7dadfa9e') OR
    (f.proname='exception' AND f.proargtypes::text='25' AND f.prorettype='text'::regtype
      AND NOT f.prosecdef AND f.pronargdefaults=0 AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='9fb58f6e8de1fc604314a290b52a1ab0aceed60c48e10b55088efb50c7133611') OR
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prosecdef AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
      encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')
   ) THEN RAISE EXCEPTION 'P0_STOP: GraphQL helper implementation/defaults not in tested contract'; END IF;
   IF f.lanname='c' AND f.probin IS DISTINCT FROM '$libdir/pg_graphql' THEN
    RAISE EXCEPTION 'P0_STOP: unexpected GraphQL native library';
   END IF;
   IF f.prosecdef AND NOT (
    (f.proname='get_schema_version' AND f.pronargs=0 AND f.prorettype='integer'::regtype AND f.lanname='sql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='0f634cd60db90d8b98917fcd3ad98976a20e478fe1365fa38f16f2836b91f5a4') OR
    (f.proname='increment_schema_version' AND f.pronargs=0 AND f.prorettype='event_trigger'::regtype AND f.lanname='plpgsql' AND
     encode(sha256(convert_to(regexp_replace(f.prosrc,'\s','','g'),'UTF8')),'hex')='91a9c30126d08f4a4260e243d6d002651e0c136fd7033db1b7e2c09c70b0aada')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed GraphQL SECURITY DEFINER helper';
   END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_class c WHERE c.relnamespace=to_regnamespace('graphql') AND c.relkind IN ('r','p','v','m','f')
    AND has_any_column_privilege(api_role,c.oid,'SELECT') AND NOT EXISTS(SELECT FROM pg_depend d
      WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass
        AND d.refobjid=ext AND d.deptype='e')) THEN
   RAISE EXCEPTION 'P0_STOP: non-extension GraphQL relation bypass';
  END IF;
 END LOOP;
END $privacy3_api$;
DO $privacy3_postcheck$
DECLARE t text; r text; a record; expected boolean;
BEGIN
 PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
 IF (SELECT count(*) FROM oaz_privacy_v3.guard_contract)<>21 OR EXISTS(
   SELECT FROM oaz_privacy_v3.guard_contract g LEFT JOIN pg_policy p ON p.polrelid=g.table_oid AND p.polname=g.policy_name
   WHERE p.oid IS NULL OR p.polpermissive OR p.polcmd<>g.command OR p.polroles<>g.roles OR
    p.polqual::text IS DISTINCT FROM g.using_tree OR p.polwithcheck::text IS DISTINCT FROM g.check_tree) THEN
  RAISE EXCEPTION 'P0_STOP: policy contract drift';
 END IF;
 IF (SELECT count(*) FROM oaz_privacy_v3.function_contract)<>12 OR EXISTS(
  SELECT FROM oaz_privacy_v3.function_contract c LEFT JOIN pg_proc p ON p.oid=c.function_oid
  WHERE p.oid IS NULL OR p.proowner<>c.owner_oid OR p.prolang<>c.language_oid OR p.prosecdef<>c.definer OR
   p.proconfig IS DISTINCT FROM c.settings OR p.proargdefaults::text IS DISTINCT FROM c.defaults_tree OR
   p.proargnames IS DISTINCT FROM c.argument_names OR p.provolatile<>c.volatility OR
   p.proisstrict<>c.strict OR p.proleakproof<>c.leakproof OR p.proparallel<>c.parallel OR
   encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>c.body_sha256) THEN
  RAISE EXCEPTION 'P0_STOP: function implementation drift';
 END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT FROM pg_roles WHERE rolname=r AND (rolsuper OR rolbypassrls)) OR
   has_database_privilege(r,current_database(),'CREATE') OR
   EXISTS(SELECT FROM oaz_privacy_v3.function_contract WHERE pg_has_role(r,owner_oid,'MEMBER')) OR
   has_schema_privilege(r,'public','CREATE') OR has_schema_privilege(r,'auth','CREATE') THEN
   RAISE EXCEPTION 'P0_STOP: API role bypass';
  END IF;
  FOREACH t IN ARRAY ARRAY['registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'] LOOP
   IF NOT (SELECT relrowsecurity AND NOT relhasrules FROM pg_class WHERE oid=format('public.%I',t)::regclass) OR
    pg_has_role(r,(SELECT relowner FROM pg_class WHERE oid=format('public.%I',t)::regclass),'MEMBER') OR
    has_table_privilege(r,format('public.%I',t),'SELECT,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') THEN
    RAISE EXCEPTION 'P0_STOP: table ACL/RLS bypass';
   END IF;
   IF (r='anon' AND (has_table_privilege(r,format('public.%I',t),'INSERT,UPDATE,DELETE') OR
     has_any_column_privilege(r,format('public.%I',t),'INSERT') OR has_any_column_privilege(r,format('public.%I',t),'UPDATE'))) OR
     (t<>'editor_5_donators' AND (has_table_privilege(r,format('public.%I',t),'UPDATE,DELETE') OR
       has_any_column_privilege(r,format('public.%I',t),'UPDATE') OR
       (t IN ('supervisor_id','who_is_boss') AND has_any_column_privilege(r,format('public.%I',t),'INSERT')))) THEN
    RAISE EXCEPTION 'P0_STOP: residual private mutation privilege';
   END IF;
   FOR a IN SELECT attname FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped LOOP
    expected:=(t='editor_5_donators' AND a.attname IN ('id','name')) OR
      (r='authenticated' AND ((t IN ('registered_member','supervisor_id') AND a.attname IN ('id','uuid')) OR
        (t='allowed_user' AND a.attname IN ('id','email'))));
    IF has_column_privilege(r,format('public.%I',t),a.attname,'SELECT') IS DISTINCT FROM expected THEN
     RAISE EXCEPTION 'P0_STOP: explicit projection drift';
    END IF;
    IF t IN ('allowed_user','registered_member') AND has_column_privilege(r,format('public.%I',t),a.attname,'INSERT') IS DISTINCT FROM
      (r='authenticated' AND ((t='allowed_user' AND a.attname IN ('name','email')) OR
       (t='registered_member' AND a.attname IN ('name','department','student_id','generation','phone_number','email','uuid','is_manager')))) THEN
      RAISE EXCEPTION 'P0_STOP: private insert column contract drift';
    END IF;
    IF t='editor_5_donators' AND (has_column_privilege(r,format('public.%I',t),a.attname,'INSERT') IS DISTINCT FROM
      (r='authenticated' AND a.attname='name') OR has_column_privilege(r,format('public.%I',t),a.attname,'UPDATE') IS DISTINCT FROM
      (r='authenticated' AND a.attname='name')) THEN RAISE EXCEPTION 'P0_STOP: donor private write ACL'; END IF;
   END LOOP;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['capabilities','state','acl_before','guard_contract','function_contract','api_contract'] LOOP
   IF has_any_column_privilege(r,format('oaz_privacy_v3.%I',t),'SELECT') OR
    has_table_privilege(r,format('oaz_privacy_v3.%I',t),'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'P0_STOP: private control table exposed';
   END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='oaz_privacy_v3' OR p.proname IN
    ('oaz_privacy_session_v3','oaz_member_self_v3','oaz_privacy_editor_list_v3','oaz_donor_write_v3','oaz_approval_add_v3'))
  AND (NOT coalesce(p.proconfig@>ARRAY['search_path=""'],false) OR
   p.prosecdef IS DISTINCT FROM (p.proname NOT IN ('oaz_donor_write_v3','oaz_approval_add_v3')) OR
   has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
  RAISE EXCEPTION 'P0_STOP: helper security contract';
 END IF;
 IF NOT has_schema_privilege('authenticated','oaz_privacy_v3','USAGE') OR EXISTS(
   SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='oaz_privacy_v3'
   AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN
  RAISE EXCEPTION 'P0_STOP: required RLS helper execution unavailable';
 END IF;
  -- Any caller-visible owner-rights dependent view/materialized view is a blocker.
  IF EXISTS(WITH RECURSIVE dependent(oid) AS (
    SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
      (n.nspname='auth' AND c.relname='users') OR (n.nspname='public'
      AND c.relname IN ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'))
    UNION SELECT r.ev_class FROM dependent x JOIN pg_depend d ON d.refobjid=x.oid AND d.refclassid='pg_class'::regclass
      JOIN pg_rewrite r ON r.oid=d.objid AND d.classid='pg_rewrite'::regclass)
    SELECT FROM dependent x JOIN pg_class c ON c.oid=x.oid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('v','m')
    AND EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
      AND has_schema_privilege(r.oid,n.oid,'USAGE') AND
      (has_table_privilege(r.oid,c.oid,'SELECT') OR has_any_column_privilege(r.oid,c.oid,'SELECT')))) THEN
    RAISE EXCEPTION 'P0_STOP: caller-visible owner-rights dependent view';
  END IF;
  -- Only the privately reviewed backup visitor function may pre-exist as public RPC.
  -- Hash metadata is compared internally; no body/name/owner/policy text is printed.
  IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.prokind='f' AND EXISTS(SELECT FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
    AND p.oid NOT IN ('public.oaz_privacy_session_v3()'::regprocedure,'public.oaz_member_self_v3()'::regprocedure,
      'public.oaz_privacy_editor_list_v3(text)'::regprocedure,'public.oaz_donor_write_v3(text,bigint,jsonb)'::regprocedure,'public.oaz_approval_add_v3(text,text)'::regprocedure)
    AND NOT (p.proname='increment_visit' AND pg_get_function_identity_arguments(p.oid)='row_id integer'
      AND l.lanname='plpgsql' AND p.prosecdef AND
      encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
      'dbb32070d8f8347144f952cf3794fd54a0ecd1a5b5b2663c277a0a845a865efb')) THEN
    RAISE EXCEPTION 'P0_STOP: unreviewed caller-visible public function';
  END IF;
END $privacy3_postcheck$;
COMMIT;
