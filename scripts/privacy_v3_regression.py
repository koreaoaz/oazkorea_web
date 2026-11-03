"""Only synthetic fixtures on the fixed loopback harness. No production connector."""
import importlib.util
import json


def run_privacy_v3(sql,check,identity,root,postgrest,context):
    d=root/'reports/main-safety/integration/sql'
    read=lambda name:(d/name).read_text(encoding='utf-8')
    spec=importlib.util.spec_from_file_location('assembler',root/'scripts/assemble-privacy.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    for name,value in module.assemble().items():check(read(name)==value,'assembled release current: '+name)
    sql((root/'tests/fixtures/privacy.sql').read_text(encoding='utf-8'))
    def defaults(mode):
        roles='anon,authenticated,service_role'
        sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO '+roles+';'
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO '+roles+';'
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO '+roles+';')
        if mode=='off':
            # Model API-facing revokes while retaining the documented non-API privileges/PUBLIC execute.
            sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM '+roles+';'
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE,SELECT ON SEQUENCES FROM '+roles+';'
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM '+roles+';')
    defaults(context.get('auto_grants','on'))
    sql('GRANT INSERT,UPDATE,DELETE ON registered_member,allowed_user,supervisor_id,who_is_boss,editor_5_donators TO anon;')
    sql("""DO $$ DECLARE t text; BEGIN
      FOREACH t IN ARRAY ARRAY['editor_0_noti','editor_1_projects','editor_2_studies'] LOOP
       EXECUTE format('CREATE POLICY fake_legacy_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(EXISTS(SELECT FROM public.supervisor_id WHERE uuid=auth.uid())) WITH CHECK(EXISTS(SELECT FROM public.supervisor_id WHERE uuid=auth.uid()))',t);
      END LOOP;
    END $$;""")
    if context.get('graphql'):
        sql((root/'tests/fixtures/graphql.sql').read_text(encoding='utf-8'))
    else:
        sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated;')
    fingerprint_query='BEGIN READ ONLY; SET LOCAL search_path=pg_catalog;\n'+read('010-catalog-fingerprint.sql')+'\nROLLBACK;'
    baseline=sql(fingerprint_query)
    approve="SET oaz.approve_privacy_v3='yes'; SET oaz.privacy_surface_review_approved='yes'; SET oaz.privacy_exposed_schemas='[\"public\"]'; SET oaz.privacy_extra_search_path='[\"public\",\"extensions\"]'; SET oaz.privacy_auto_expose_new_tables='on'; SET oaz.privacy_expected_catalog_sha256='"+baseline+"';"
    if context.get('graphql'):
        approve=approve.replace('[\"public\"]','[\"public\",\"graphql_public\"]')
    approve=approve.replace("privacy_auto_expose_new_tables='on'","privacy_auto_expose_new_tables='"+context.get('auto_grants','on')+"'")
    apply=read('010-privacy-minimal.sql');post=read('010-postcheck.sql')
    if not context.get('graphql'):
        # Dashboard declarations must not be silently widened to an untested API path.
        check(sql(approve+"SET oaz.privacy_exposed_schemas='[\"public\",\"graphql_public\"]';"+apply,False),
              'declared GraphQL scope without a real reviewed wrapper is refused')
        check(sql("SELECT to_regnamespace('oaz_privacy_v3') IS NULL;")=='t',
              'unsupported API scope creates no partial privacy schema')
        sql('CREATE SCHEMA graphql_public;')
        graphql_seal=sql(fingerprint_query)
        check(graphql_seal!=baseline,'GraphQL and extra-search-path schema ACLs change catalog seal')
        sql('CREATE FUNCTION graphql_public.fake_graphql() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;')
        check(sql(fingerprint_query)!=graphql_seal,'GraphQL wrapper implementation changes catalog seal')
        inventory=json.loads(sql(read('010-api-surface-readonly.sql')))
        check(any(x['schema']=='graphql_public' for x in inventory['schema_role_inventory']),
              'read-only API inventory covers GraphQL schema without reading member rows')
        sql('DROP FUNCTION graphql_public.fake_graphql(); DROP SCHEMA graphql_public;')
        check(sql(fingerprint_query)==baseline,'removing synthetic API surfaces restores original seal')

    else:
        from privacy_graphql_regression import guard_negatives
        guard_negatives(sql,check,approve,baseline,fingerprint_query,apply,root)

    # Model the table component of the Dashboard toggle; not a real Dashboard/pg_graphql test.
    sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated; CREATE TABLE public.fake_auto_on(id integer);')
    check(sql("SELECT has_table_privilege('anon','public.fake_auto_on','SELECT');")=='t',
          'auto-grant ON model exposes a newly created unprotected public table')
    sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM anon,authenticated; CREATE TABLE public.fake_auto_off(id integer);')
    check(sql("SELECT has_table_privilege('anon','public.fake_auto_off','SELECT');")=='f',
          'auto-grant OFF model denies a future public table without explicit grants')
    check(sql("SELECT has_table_privilege('anon','public.fake_auto_on','SELECT');")=='t',
          'changing defaults never repairs existing table grants')
    sql('GRANT SELECT ON public.fake_auto_off TO anon;')
    check(sql("SELECT has_table_privilege('anon','public.fake_auto_off','SELECT');")=='t',
          'explicit minimum grant supports future intended public migrations with auto-grant OFF')
    sql('CREATE FUNCTION public.fake_default_function() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;')
    check(sql("SELECT has_function_privilege('anon','public.fake_default_function()','EXECUTE');")=='t',
          'turning off table auto-grants does not remove global PUBLIC function execution')
    sql('REVOKE ALL ON FUNCTION public.fake_default_function() FROM PUBLIC,anon,authenticated;')
    check(sql("SELECT has_function_privilege('anon','public.fake_default_function()','EXECUTE');")=='f',
          'explicit function ACL prevents unintended new RPC exposure')
    sql('DROP FUNCTION public.fake_default_function(); DROP TABLE public.fake_auto_on,public.fake_auto_off;')
    defaults(context.get('auto_grants','on'))
    sql('CREATE SCHEMA fake_future_private; REVOKE ALL ON SCHEMA fake_future_private FROM PUBLIC,anon,authenticated,service_role;'
        'CREATE TABLE fake_future_private.admin_secret(id integer); ALTER TABLE fake_future_private.admin_secret ENABLE ROW LEVEL SECURITY;'
        'ALTER TABLE fake_future_private.admin_secret FORCE ROW LEVEL SECURITY;'
        'REVOKE ALL ON fake_future_private.admin_secret FROM PUBLIC,anon,authenticated,service_role;')
    check(sql("SELECT NOT has_any_column_privilege('anon','fake_future_private.admin_secret','SELECT') AND NOT has_any_column_privilege('authenticated','fake_future_private.admin_secret','SELECT');")=='t',
          'future private admin source stays inaccessible in the selected automatic-grant mode')
    sql('DROP TABLE fake_future_private.admin_secret; DROP SCHEMA fake_future_private;')
    # Restore fixture default ACL exactly; PostgreSQL removes empty default rows automatically.
    check(sql(fingerprint_query)==baseline,'default-grant simulation leaves original reviewed catalog unchanged')
    check(sql(read('010-body.sql'),False),'build fragment cannot bypass preflight by running standalone')
    check(sql(apply,False),'v3 unapproved apply refused')
    check(sql(approve+"SET oaz.privacy_expected_catalog_sha256='"+'0'*64+"';"+apply,False),'wrong catalog seal refused')
    sql('ALTER POLICY legacy_select ON registered_member USING(false);')
    check(sql(approve+apply,False),'policy drift after seal capture refused')
    sql('ALTER POLICY legacy_select ON registered_member USING(true);')
    check(sql(fingerprint_query)==baseline,'restoring synthetic policy restores catalog seal')
    sql('GRANT SELECT(uuid) ON editor_5_donators TO PUBLIC;')
    current=sql(fingerprint_query)
    check(sql(approve.replace(baseline,current)+apply,False),'even freshly sealed inherited PUBLIC private grant aborts apply')
    check(sql("SELECT to_regnamespace('oaz_privacy_v3') IS NULL;")=='t','failed postcheck rolls back v3 schema and ACL')
    sql('REVOKE SELECT(uuid) ON editor_5_donators FROM PUBLIC;')
    sql('GRANT DELETE ON editor_5_donators TO PUBLIC;')
    bad_mutation=sql(fingerprint_query)
    check(sql(approve.replace(baseline,bad_mutation)+apply,False),'inherited PUBLIC mutation grant is not silently retained')
    sql('REVOKE DELETE ON editor_5_donators FROM PUBLIC;')
    sql('CREATE ROLE synthetic_reader; GRANT SELECT(uuid) ON editor_5_donators TO synthetic_reader; GRANT synthetic_reader TO authenticated;')
    inherited=sql(fingerprint_query)
    check(sql(approve.replace(baseline,inherited)+apply,False),'inherited custom-role private grant aborts atomic installation')
    sql('REVOKE synthetic_reader FROM authenticated; REVOKE SELECT(uuid) ON editor_5_donators FROM synthetic_reader; DROP ROLE synthetic_reader;')
    sql("CREATE POLICY fake_dependency ON public.editor_0_noti FOR SELECT USING(EXISTS(SELECT FROM public.supervisor_id WHERE email IS NOT NULL));")
    changed=sql(fingerprint_query)
    check(sql(approve.replace(baseline,changed)+apply,False),'incompatible existing foreign-column policy is rejected before install')
    sql('DROP POLICY fake_dependency ON public.editor_0_noti;')
    sql(approve+apply)
    check('P0_V3_POSTCHECK_PASS_METADATA_ONLY' in sql(post),'v3 postcheck passes')
    check(sql(approve+apply,False),'v3 replay refused without overwrite')
    check(sql('SELECT count(*) FROM oaz_privacy_v3.capabilities;')=='0','installation grants zero business capabilities')

    def allowed(query,expected,label):check(sql(query)==str(expected),label)
    def denied(prefix,query,label,code='42501'):
        sql(prefix+"DO $denied$ BEGIN "+query+"; RAISE EXCEPTION 'Unexpected success'; EXCEPTION WHEN SQLSTATE '"+code+"' THEN NULL; END $denied$;")
        check(True,label)
    def uid(n):return f'00000000-0000-4000-8000-{n:012d}'
    def listing(n,table):return identity(n)+"SELECT oaz_privacy_editor_list_v3('"+table+"');"
    for table in ('registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators'):
        for command in (f'DELETE FROM {table}',f"UPDATE {table} SET name='fake anonymous'",f"INSERT INTO {table}(name) VALUES('fake anonymous')"):
            denied('SET ROLE anon;',command,'anonymous mutation privilege revoked '+table+' '+command.split()[0])
    denied('',f"INSERT INTO oaz_privacy_v3.capabilities VALUES('{uid(1)}','super.all','LEGACY',NULL)",'unknown future capability cannot be granted implicitly','23514')
    for table,column in [('registered_member','email'),('allowed_user','email'),('supervisor_id','uuid'),('who_is_boss','uuid')]:
        denied('SET ROLE anon;',f'PERFORM {column} FROM {table}','anonymous enumeration denied '+table)
    for n in (2,3):
        allowed(identity(n)+f"SELECT count(uuid) FROM registered_member WHERE uuid='{uid(n)}';",1,'member own login UUID allowed '+str(n))
        allowed(identity(n)+f"SELECT count(uuid) FROM registered_member WHERE uuid='{uid(5-n)}';",0,'member cross-UUID direct API filter denied '+str(n))
        for column in ('email','phone_number','student_id','is_manager','name'):
            denied(identity(n),f'PERFORM {column} FROM registered_member','direct member private column denied '+column+' '+str(n))
        own=json.loads(sql(identity(n)+'SELECT oaz_member_self_v3();'))
        check(set(own)=={'name','department','generation'},'own profile exact minimum projection '+str(n))
    denied('',f"INSERT INTO registered_member(uuid,email,name) VALUES('{uid(2)}','duplicate@example.invalid','fake duplicate')",'existing unique member UUID prevents signup race duplicates','23505')
    sql('ALTER TABLE registered_member DROP CONSTRAINT registered_member_uuid_key;')
    duplicate_id=sql(f"INSERT INTO registered_member(uuid,email,name) VALUES('{uid(2)}','duplicate@example.invalid','fake duplicate') RETURNING id;")
    denied(identity(2),'PERFORM oaz_member_self_v3()','duplicate own profile fails explicitly instead of selecting an arbitrary row','40001')
    sql('DELETE FROM registered_member WHERE id='+duplicate_id+';')
    sql('ALTER TABLE registered_member ADD CONSTRAINT registered_member_uuid_key UNIQUE(uuid);')
    allowed(identity(2)+'SELECT count(email) FROM allowed_user;',1,'own verified approval read preserved for signup')
    allowed(identity(2,'other@example.invalid')+'SELECT count(email) FROM allowed_user;',0,'forged email claim cannot inspect another approval')
    for table in ('registered_member','allowed_user','supervisor_id'):
        denied(identity(1),f"PERFORM oaz_privacy_editor_list_v3('{table}')",'legacy admin not implicitly granted '+table)
    denied(identity(6),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'super-admin candidate not implicitly granted members')
    allowed(identity(1)+'SELECT count(uuid) FROM supervisor_id;',1,'legacy Editor own identity preserved')
    denied(identity(1),'PERFORM email FROM supervisor_id','legacy administrator cannot directly enumerate supervisor emails')
    allowed('SET ROLE anon; SELECT count(id||name) FROM editor_5_donators;',1,'public donor id/name preserved')
    for n in (1,2):
        for col in ('uuid','date','created_at'):
            denied(identity(n),f'PERFORM {col} FROM editor_5_donators','donor direct private column denied '+col+' '+str(n))
    public=json.loads(sql(listing(1,'editor_5_donators')))
    check(public['fields']==['name'] and set(public['rows'][0])=={'id','name'},'donor Editor has public-only rows without PII approval')
    denied(identity(1),"PERFORM oaz_donor_write_v3('create',NULL,'{\"name\":\"fake\"}')",'SQL installation keeps donor writes paused')
    enable=read('011-enable-donor-writes.sql')
    check(sql(enable,False),'donor activation needs distinct rollout approval')
    sql("SET oaz.approve_donor_v3_enable='yes';"+enable)
    created=json.loads(sql(identity(1)+"SELECT oaz_donor_write_v3('create',NULL,'{\"name\":\"fake public\"}');"))
    check(set(created)=={'id','name'},'public-name donor create returns no private data')
    allowed(identity(1)+f"SELECT oaz_donor_write_v3('update',{created['id']},'{{\"name\":\"fake updated\"}}')->>'name';",'fake updated','public donor name update')
    allowed(identity(1)+f"SELECT oaz_donor_write_v3('delete',{created['id']},'{{}}')->>'id';",created['id'],'public donor delete')
    denied(identity(1),"PERFORM oaz_donor_write_v3('delete',99999,'{}')",'zero-row donor mutation rejected','40001')
    for key in ('date','uuid','created_at'):
        denied(identity(1),"PERFORM oaz_donor_write_v3('create',NULL,'{\"name\":\"fake\",\""+key+"\":\"fake\"}')",'private donor payload refused '+key,'22023')
        denied(identity(1),f"UPDATE editor_5_donators SET {key}=NULL WHERE id=1",'direct donor private write refused '+key)
    denied(identity(2),"PERFORM oaz_donor_write_v3('create',NULL,'{\"name\":\"fake\"}')",'ordinary user cannot mutate donor content')
    allowed(identity(4,'new@example.invalid')+"INSERT INTO registered_member(uuid,email,name,department,generation,student_id,phone_number,is_manager) VALUES(auth.uid(),'new@example.invalid','fake','fake','fake','fake','fake',false); SELECT count(uuid) FROM registered_member;",1,'existing signup full insert and own lookup work with UUID-only SELECT')
    denied(identity(4,'new@example.invalid'),f"INSERT INTO registered_member(uuid,email) VALUES('{uid(8)}','new@example.invalid')",'signup UUID impersonation denied')
    denied(identity(8,'synthetic@example.invalid'),"INSERT INTO registered_member(uuid,email) VALUES(auth.uid(),'synthetic@example.invalid')",'unapproved signup denied')
    denied(identity(4,'new@example.invalid'),"INSERT INTO registered_member(uuid,email,is_manager) VALUES(auth.uid(),'new@example.invalid',true)",'signup manager flag escalation denied')
    sql(f"UPDATE auth.users SET email_confirmed_at=NULL WHERE id='{uid(4)}';")
    denied(identity(4,'new@example.invalid'),"INSERT INTO registered_member(uuid,email) VALUES(auth.uid(),'new@example.invalid')",'unconfirmed signup denied')
    sql(f"UPDATE auth.users SET email_confirmed_at=now() WHERE id='{uid(4)}';")
    for table in ('registered_member','allowed_user','supervisor_id','who_is_boss'):
        denied(identity(1),f'DELETE FROM {table}','directory read/content editing never grants private mutation '+table)
    for cap in ('members.read','approvals.read','donors.private.read','administrators.directory.read'):
        sql(f"INSERT INTO oaz_privacy_v3.capabilities VALUES('{uid(1)}','{cap}','LEGACY',NULL);")
    member=json.loads(sql(listing(1,'registered_member')))
    check(member['fields']==['name','department','generation'] and all(set(r)=={'id','name','department','generation'} for r in member['rows']),'approved members capability excludes phone/email/student ID/UUID/manager flag')
    approvals=json.loads(sql(listing(1,'allowed_user')))
    check(all(set(r)=={'id','name','email'} for r in approvals['rows']),'approval capability has separate exact projection')
    directory=json.loads(sql(listing(1,'supervisor_id')))
    check(all(set(r)=={'id','name'} for r in directory['rows']),'admin directory capability excludes email and UUID')
    donors=json.loads(sql(listing(1,'editor_5_donators')))
    check(all(set(r)=={'id','name','date'} for r in donors['rows']),'donor private read exposes only separately approved date')
    denied(identity(1),'UPDATE oaz_privacy_v3.capabilities SET authority=\'ADMIN_V2\'','client cannot edit capability grants')
    sql("DELETE FROM oaz_privacy_v3.capabilities WHERE capability='members.read';")
    denied(identity(1),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'grant revocation applies to next request with same identity')
    sql(f"UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='{uid(1)}';")
    denied(identity(1),"PERFORM oaz_privacy_editor_list_v3('allowed_user')",'Auth-inactive admin denied despite stored grant')
    denied(identity(1),"PERFORM oaz_donor_write_v3('delete',1,'{}')",'Auth-inactive admin content write denied')
    allowed(identity(1)+"WITH changed AS(UPDATE editor_0_noti SET description='fake blocked' WHERE id=1 RETURNING id) SELECT count(*) FROM changed;",0,'Auth-inactive administrator cannot bypass legacy content update guard')
    sql(f"UPDATE auth.users SET banned_until=NULL WHERE id='{uid(1)}';")
    sql("CREATE SCHEMA oaz_admin_v2; CREATE TABLE oaz_admin_v2.assignments(slot text,user_id uuid,role text,status text,revision bigint);")
    sql(f"INSERT INTO oaz_admin_v2.assignments VALUES('admin1','{uid(1)}','SUPER_ADMIN','active',0),('admin2','{uid(2)}','ADMIN','active',0),('admin5','{uid(5)}','ADMIN','disabled',0);")
    denied(identity(1),"PERFORM oaz_privacy_editor_list_v3('allowed_user')",'admin-v2 installation invalidates legacy authority grants')
    denied(identity(1),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'super admin has no implicit members capability')
    sql(f"INSERT INTO oaz_privacy_v3.capabilities VALUES('{uid(2)}','members.read','ADMIN_V2',0);")
    check(len(json.loads(sql(listing(2,'registered_member')))['rows'])==3,'explicit capability works for ordinary admin2 independently of role grade')
    sql("UPDATE oaz_admin_v2.assignments SET revision=1 WHERE slot='admin2';")
    denied(identity(2),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'assignment revision invalidates old capability grant immediately')
    sql("UPDATE oaz_privacy_v3.capabilities SET assignment_revision=1 WHERE authority='ADMIN_V2'; UPDATE oaz_admin_v2.assignments SET status='disabled' WHERE slot='admin2';")
    denied(identity(2),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'disabled admin-v2 account cannot reuse capability')
    sql("UPDATE oaz_admin_v2.assignments SET status='active' WHERE slot='admin2';")
    allowed(identity(2)+"SELECT oaz_privacy_session_v3()->>'donorWrite';",'false','new admin assignment never invents legacy donor write authority')
    sql(f"INSERT INTO oaz_privacy_v3.capabilities VALUES('{uid(1)}','approvals.write','ADMIN_V2',0);")
    denied(identity(1),"PERFORM oaz_approval_add_v3('fake','fake-approve@example.invalid')",'business approval alone does not bypass write activation')
    approval_enable=read('012-enable-approval-writes.sql')
    check(sql(approval_enable,False),'approval write activation requires its own operational approval')
    sql("SET oaz.approve_approval_v3_enable='yes';"+approval_enable)
    allowed(identity(1)+"SELECT oaz_approval_add_v3('fake','fake-approve@example.invalid')->>'saved';",'true','approved email add preserves existing invoker write RLS without directory read')
    denied(identity(1),"PERFORM oaz_approval_add_v3('fake','fake-approve@example.invalid')",'duplicate approval is rejected by existing unique constraint','23505')
    denied(identity(3),"PERFORM oaz_approval_add_v3('fake','fake-bad@example.invalid')",'ordinary member cannot add an approval')
    for table in ('editor_0_noti','editor_1_projects','editor_2_studies'):
        allowed(identity(1)+f'SELECT count(*)>=0 FROM {table};','t','legacy content read remains '+table)
    sql(identity(1)+"UPDATE editor_0_noti SET description='fake v3 edit' WHERE id=1;")
    allowed("SELECT description='fake v3 edit' FROM editor_0_noti WHERE id=1;",'t','legacy notice edit remains')
    # Test REAL PostgREST with locally signed synthetic JWTs, not a mock HTTP server.
    if postgrest:
        from privacy_http_regression import run_http
        run_http(sql,check,postgrest,context)
    if context.get('graphql'):
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY DEFINER;')
        check(sql(post,False),'postcheck detects GraphQL definer drift after installation')
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY INVOKER;')
        check('P0_V3_POSTCHECK_PASS_METADATA_ONLY' in sql(post),'postcheck passes only after restoring reviewed GraphQL invoker')
    recovery=read('010-recovery.sql')
    check(sql(recovery,False),'safe recovery needs separate approval')
    sql("SET oaz.approve_privacy_v3_recovery='yes';"+recovery)
    denied(identity(1),"PERFORM oaz_donor_write_v3('delete',1,'{}')",'safe recovery disables writes without reopening reads')
    denied(identity(1),"PERFORM oaz_approval_add_v3('fake','fake-recovery@example.invalid')",'safe recovery disables approval writes as well')
    denied('SET ROLE anon;','PERFORM email FROM registered_member','safe recovery retains anonymous email protection')
    denied(identity(2),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'safe recovery pauses optional directory RPCs')
    check('P0_V3_POSTCHECK_PASS_METADATA_ONLY' in sql(post),'safe recovery retains all privacy invariants')
    if context.get('graphql'):
        check(sql("SELECT NOT has_function_privilege('anon','graphql_public.graphql(text,text,jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('authenticated','graphql_public.graphql(text,text,jsonb,jsonb)','EXECUTE');")=='t',
              'safe recovery contains GraphQL execution as well as private RPCs')
        gql_resume=read('015-resume-reviewed-graphql.sql')
        check(sql(gql_resume,False),'GraphQL resumption requires separate operational approval')
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY DEFINER;')
        check(sql("SET oaz.approve_graphql_v3_resume='yes';"+gql_resume,False),
              'GraphQL grants cannot resume while the wrapper is unsafe')
        check(sql("SELECT NOT has_function_privilege('authenticated','graphql_public.graphql(text,text,jsonb,jsonb)','EXECUTE');")=='t',
              'failed GraphQL resumption atomically rolls back execute grants')
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY INVOKER;')
        sql("SET oaz.approve_graphql_v3_resume='yes';"+gql_resume)
        check('P0_V3_POSTCHECK_PASS_METADATA_ONLY' in sql(post),'reviewed GraphQL resumes with all privacy guards intact')
    resume=read('013-resume-reviewed-reads.sql')
    check(sql(resume,False),'read resumption requires independent review approval')
    sql("SET oaz.approve_privacy_v3_reads='yes';"+resume)
    denied(identity(1),"PERFORM oaz_privacy_editor_list_v3('registered_member')",'resuming reads never implicitly grants business capability')
