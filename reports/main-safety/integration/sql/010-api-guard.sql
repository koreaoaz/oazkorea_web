-- Source fragment assembled into preflight/apply/postcheck. No application rows.
-- Dashboard declarations are operator attestations, not remotely detected configuration.
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
