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
