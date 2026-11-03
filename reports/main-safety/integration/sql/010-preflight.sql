-- Generated with 010-api-guard.sql. Metadata only.
BEGIN READ ONLY;
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
ROLLBACK;
