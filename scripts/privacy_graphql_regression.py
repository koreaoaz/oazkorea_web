"""Actual pg_graphql fixtures and negative API guard regressions. No production connector."""
import json
import re
import importlib.util


def guard_negatives(sql,check,approve,baseline,fingerprint_query,apply,root):
    sql(approve+(root/'reports/main-safety/integration/sql/010-preflight.sql').read_text(encoding='utf-8'))
    check(True,'known-good real GraphQL and standard-extension preflight succeeds before negative cases')
    def rejected(command,undo,label):
        sql(command)
        changed=sql(fingerprint_query)
        check(sql(approve.replace(baseline,changed)+apply,False),label)
        check(sql("SELECT to_regnamespace('oaz_privacy_v3') IS NULL;")=='t','GraphQL guard failure leaves no partial installation')
        sql(undo)
        check(sql(fingerprint_query)==baseline,'reviewed GraphQL fixture restored after negative case')
    check(sql(approve+"SET oaz.privacy_extra_search_path='[\"public\",\"extensions\",\"auth\"]';"+apply,False),
          'unreviewed extra search path rejected')
    check(sql(approve+"SET oaz.privacy_auto_expose_new_tables='unknown';"+apply,False),
          'unattested automatic grant mode rejected')
    rejected('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY DEFINER;',
             'ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY INVOKER;',
             'GraphQL wrapper SECURITY DEFINER escalation rejected even with fresh seal')
    rejected('CREATE FUNCTION graphql_public.fake_bypass() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT email FROM public.registered_member LIMIT 1 $$;',
             'DROP FUNCTION graphql_public.fake_bypass();','unexpected callable GraphQL wrapper rejected')
    rejected('CREATE VIEW extensions.fake_owner_view AS SELECT email FROM public.registered_member; GRANT SELECT ON extensions.fake_owner_view TO anon;',
             'DROP VIEW extensions.fake_owner_view;','extra-search-path owner view bypass rejected')
    rejected('GRANT CREATE ON SCHEMA extensions TO authenticated;',
             'REVOKE CREATE ON SCHEMA extensions FROM authenticated;','extra-search-path object injection privilege rejected')
    rejected('ALTER SCHEMA extensions RENAME TO fake_hidden_extensions;',
             'ALTER SCHEMA fake_hidden_extensions RENAME TO extensions;',
             'missing declared extra search-path namespace is rejected before deployment')
    rejected('GRANT oaz_synthetic TO authenticated WITH INHERIT FALSE;',
             'REVOKE oaz_synthetic FROM authenticated;',
             'NOINHERIT owner membership with SET capability is rejected')
    rejected("CREATE FUNCTION extensions.fake_claim_override() RETURNS text LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims','{}',true) $$;",
             'DROP FUNCTION extensions.fake_claim_override();',
             'unreviewed invoker function on extra search path cannot forge caller claims')
    comment=sql("SELECT quote_nullable(obj_description('extensions.pg_stat_statements'::regclass,'pg_class'));")
    rejected("COMMENT ON VIEW extensions.pg_stat_statements IS '@graphql({\"primary_key_columns\":[\"queryid\"]})';",
             'COMMENT ON VIEW extensions.pg_stat_statements IS '+comment+';',
             'statistics owner view cannot be newly reflected into GraphQL')
    rejected("ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SET request.jwt.claims='{}';",
             'ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) RESET ALL;',
             'GraphQL wrapper cannot override the verified session claims')
    original=sql("SELECT pg_get_functiondef('graphql.resolve(text,jsonb,text,jsonb)'::regprocedure);")
    rejected("CREATE OR REPLACE FUNCTION graphql.resolve(query text,variables jsonb DEFAULT '{}',\"operationName\" text DEFAULT NULL,extensions jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN PERFORM set_config('request.jwt.claims','{}',true); RETURN '{}'::jsonb; END $$;",
             original,'invoker GraphQL helper body tampering is rejected even with a fresh seal')
    wrapper_original=sql("SELECT pg_get_functiondef('graphql_public.graphql(text,text,jsonb,jsonb)'::regprocedure);")
    sql((root/'tests/fixtures/graphql-placeholder.sql').read_text(encoding='utf-8'))
    placeholder_seal=sql(fingerprint_query)
    check(not sql(approve.replace(baseline,placeholder_seal)+(root/'reports/main-safety/integration/sql/010-preflight.sql').read_text(encoding='utf-8'),False),
          'reviewed inactive platform placeholder passes read-only preflight without activating GraphQL')
    sql(wrapper_original)
    check(sql(fingerprint_query)==baseline,'active GraphQL wrapper restored after inactive-mode compatibility check')

    # Latest live inventory reports no pg_graphql extension. Test that distinct
    # state with fake metadata only; never infer the live wrapper body from counts.
    pre=(root/'reports/main-safety/integration/sql/010-preflight.sql').read_text(encoding='utf-8')
    blocks='\n'.join(re.findall(r'DO \$privacy3_(?:api|preflight)\$.*?END \$privacy3_(?:api|preflight)\$;',pre,re.S))
    seal_query=(root/'reports/main-safety/integration/sql/010-catalog-fingerprint.sql').read_text(encoding='utf-8')
    seal_query=seal_query.replace(' AS catalog_sha256 FROM document;',' INTO observed FROM document;')
    absent="BEGIN; SET LOCAL search_path=pg_catalog; DROP EXTENSION pg_graphql CASCADE;\n"+(root/'tests/fixtures/graphql-placeholder.sql').read_text(encoding='utf-8')
    absent+=approve+"\nDO $fresh$ DECLARE observed text; BEGIN "+seal_query+"\nPERFORM set_config('oaz.privacy_expected_catalog_sha256',observed,true); END $fresh$;\n"
    absent+=blocks+"\nROLLBACK;"
    sql(absent)
    check(True,'extension-absent reviewed placeholder passes actual PostgreSQL preflight with a fresh synthetic seal')
    check(sql(fingerprint_query)==baseline,'extension-absent trial rolls back without changing the reviewed active baseline')

    # Exercise the actual operator payload only on a disposable local PG 17.6.
    if sql("SELECT current_setting('server_version_num');") == '170006':
        spec=importlib.util.spec_from_file_location('local_preflight_runner',root/'scripts/main-p0-preflight.py')
        runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
        sql('CREATE ROLE postgres SUPERUSER LOGIN;')
        synthetic_seal=sql(fingerprint_query)
        actual=sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload(synthetic_seal))
        check(actual=='P0_PREFLIGHT_PASS\nP0_ROLLBACK_COMPLETE','actual operator payload passes and confirms rollback on isolated PG 17.6')
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload('0'*64),False),
              'actual operator payload rejects stale synthetic seal')
        wrong_version=runner.payload(synthetic_seal).replace("<> '170006'", "<> '170005'")
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+wrong_version,False),
              'actual operator payload rejects an unreviewed server version')
        sql('ALTER TABLE public.registered_member DISABLE ROW LEVEL SECURITY;')
        changed=sql(fingerprint_query)
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload(changed),False),
              'actual operator payload rejects missing RLS with a fresh synthetic seal')
        sql('ALTER TABLE public.registered_member ENABLE ROW LEVEL SECURITY;')
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY DEFINER;')
        changed=sql(fingerprint_query)
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload(changed),False),
              'actual operator payload rejects an altered GraphQL wrapper with a fresh synthetic seal')
        sql('ALTER FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) SECURITY INVOKER;')
        sql('CREATE POLICY fake_restrictive ON public.registered_member AS RESTRICTIVE FOR SELECT TO authenticated USING (false);')
        changed=sql(fingerprint_query)
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload(changed),False),
              'actual operator payload rejects an unreviewed restrictive policy with a fresh synthetic seal')
        sql('DROP POLICY fake_restrictive ON public.registered_member;')
        sql('CREATE SCHEMA oaz_privacy_v3;')
        changed=sql(fingerprint_query)
        check(sql('SET SESSION AUTHORIZATION postgres;\n'+runner.payload(changed),False),
              'operator gate refuses an existing privacy schema before executing its objects')
        sql('DROP SCHEMA oaz_privacy_v3;')
        sql('DROP ROLE postgres;')
        check(sql(fingerprint_query)==baseline,'operator payload trial leaves the synthetic catalog unchanged')


def run_http_graphql(sql,check,request,token,context):
    """Actual pg_graphql over actual PostgREST profile routing and signed synthetic JWTs."""
    uid=lambda n:f'00000000-0000-4000-8000-{n:012d}'
    sql("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('"+uid(9)+"','graphql-new@example.invalid',now());")
    sql("INSERT INTO public.supervisor_id(uuid,name,email) VALUES('"+uid(6)+"','fake legacy','synthetic@example.invalid');")
    actors=[(None,'anon'),(3,'member A'),(4,'member B'),(6,'legacy administrator'),
            (2,'new ordinary administrator'),(1,'super administrator'),(5,'disabled administrator')]

    def expect(condition,label,result=None):
        if not condition:
            (context['lab']/'graphql-failure-private.json').write_text(json.dumps({'label':label,'synthetic_response':result},indent=2),encoding='utf-8')
        check(condition,label)

    def gql(query,n=None,jwt=None):
        status,body=request('/rpc/graphql',jwt if jwt is not None else (token(n) if n else None),
                            {'query':query},profile='graphql_public')
        if status!=200 or not isinstance(body,dict):
            expect(False,'GraphQL HTTP transport/profile/engine returns a valid response',{'status':status,'body':body})
        return body

    def positive(query,n,label):
        body=gql(query,n)
        expect(not body.get('errors') and isinstance(body.get('data'),dict),label,body)
        return body['data']

    def json_scalar(value):
        # pg_graphql serializes json/jsonb as an encoded JSON string scalar.
        # Validate the decoded contract just as strictly as the REST JSON object.
        if not isinstance(value,str):raise AssertionError('Unexpected GraphQL JSON scalar representation')
        return json.loads(value)

    def denied(query,n,label):
        body=gql(query,n)
        messages=' '.join(str(x.get('message','')) for x in body.get('errors',[]) if isinstance(x,dict)).lower()
        recognizable=any(x in messages for x in ['unknown field','permission','privilege','row-level security'])
        expect(bool(body.get('errors')) and recognizable and
               (body.get('data') is None or all(v is None for v in body['data'].values())),label,body)

    roots=positive('query{__schema{queryType{fields{name}}}}',3,'GraphQL reflection positive control with standard extra extensions')
    names={x['name'] for x in roots['__schema']['queryType']['fields']}
    expect(not any(x.startswith('pgStatStatements') for x in names),
           'non-key statistics views/record functions remain outside the GraphQL API')
    denied('query{pgStatStatementsCollection(first:0){edges{node{query}}}}',3,
           'GraphQL cannot query a non-reflected standard statistics view')
    status,result=request('/pg_stat_statements?select=query&limit=0',token(3),profile='extensions')
    expect(status==406 and result.get('code')=='PGRST106',
           'extra search path is not an exposed REST schema',result)

    for n,label in actors:
        data=positive('query{editor5DonatorsCollection(first:10){edges{node{id name}}}}',n,
                      'GraphQL public donor positive control: '+label)
        rows=[x['node'] for x in data['editor5DonatorsCollection']['edges']]
        expect(bool(rows) and all(set(x)=={'id','name'} for x in rows),'GraphQL donor exact public projection: '+label,rows)
        for query,kind in [
            ('query{registeredMemberCollection{edges{node{email}}}}','member email'),
            ('query{allowedUserCollection{edges{node{name email}}}}','approval directory'),
            ('query{supervisorIdCollection{edges{node{name email}}}}','administrator directory'),
            ('query{whoIsBossCollection{edges{node{uuid}}}}','boss directory'),
            ('query{editor5DonatorsCollection{edges{node{uuid date createdAt}}}}','private donor fields')]:
            denied(query,n,'GraphQL private projection blocked: '+label+' / '+kind)
        if n not in (2,):
            denied('query{oazPrivacyEditorListV3(board:"registered_member")}',n,
                   'GraphQL RPC cannot confer implicit member capability: '+label)

    for n,other in [(3,4),(4,3)]:
        data=positive('query{registeredMemberCollection(filter:{uuid:{eq:"'+uid(other)+'"}}){edges{node{uuid}}}}',n,
                      'GraphQL direct cross-member UUID filter executes with RLS')
        expect(data['registeredMemberCollection']['edges']==[],'GraphQL A/B row boundary preserved',data)
        own=positive('query{oazMemberSelfV3}',n,'GraphQL own profile RPC succeeds')
        expect(set(json_scalar(own['oazMemberSelfV3']))=={'name','department','generation'},'GraphQL own profile minimum columns',own)

    approved=positive('query{oazPrivacyEditorListV3(board:"registered_member")}',2,
                      'GraphQL explicit administrator capability works')
    expect(all(set(x)=={'id','name','department','generation'} for x in json_scalar(approved['oazPrivacyEditorListV3'])['rows']),
           'GraphQL approved member projection excludes contact and identity fields',approved)
    same_jwt=token(2)
    sql("UPDATE oaz_admin_v2.assignments SET status='disabled' WHERE slot='admin2';")
    body=gql('query{oazPrivacyEditorListV3(board:"registered_member")}',jwt=same_jwt)
    expect(bool(body.get('errors')) and body.get('data') is None,'GraphQL disabled assignment rejects unchanged JWT',body)
    sql("UPDATE oaz_admin_v2.assignments SET status='active' WHERE slot='admin2';")
    forged=gql('query{oazPrivacyEditorListV3(board:"registered_member")}',jwt=token(3,extra={'capabilities':['members.read'],'role_metadata':{'role':'SUPER_ADMIN'}}))
    expect(bool(forged.get('errors')) and forged.get('data') is None,'GraphQL forged capability claims cannot grant PII',forged)

    for n in (3,4,5):
        denied('mutation{deleteFromRegisteredMemberCollection(atMost:1){affectedCount}}',n,
               'GraphQL unauthorized member deletion blocked')
        before=sql('SELECT name FROM public.editor_5_donators WHERE id=1;')
        result=gql('mutation{updateEditor5DonatorsCollection(set:{name:"fake unauthorized"},filter:{id:{eq:1}},atMost:1){affectedCount}}',n)
        expect(not result.get('errors') and result['data']['updateEditor5DonatorsCollection']['affectedCount']==0 and
               sql('SELECT name FROM public.editor_5_donators WHERE id=1;')==before,
               'GraphQL unauthorized donor mutation affects zero rows and preserves data',result)
        denied('mutation{oazApprovalAddV3(approvalName:"fake",approvalEmail:"fake-forbidden@example.invalid")}',n,
               'GraphQL unapproved approval RPC blocked')

    for n in (1,6):
        result=positive('mutation{updateEditor0NotiCollection(set:{text:"fake GraphQL edited"},filter:{id:{eq:1}},atMost:1){affectedCount}}',n,
                        'GraphQL approved legacy content edit succeeds')
        expect(result['updateEditor0NotiCollection']['affectedCount']==1,'GraphQL content edit confirms one changed fake row',result)
    result=positive('mutation{updateEditor0NotiCollection(set:{text:"fake disabled"},filter:{id:{eq:1}},atMost:1){affectedCount}}',5,
                    'GraphQL disabled content editor request executes under RLS')
    expect(result['updateEditor0NotiCollection']['affectedCount']==0,'GraphQL disabled content editor cannot mutate content',result)

    def donor_command(operation,record_id,payload,n):
        encoded=json.dumps(json.dumps(payload))
        return gql('mutation{oazDonorWriteV3(operation:'+json.dumps(operation)+',recordId:'+
                   ('null' if record_id is None else str(record_id))+',payload:'+encoded+')}',n)
    created=donor_command('create',None,{'name':'fake GraphQL donor'},1)
    expect(not created.get('errors'),'GraphQL approved donor RPC create succeeds',created)
    donor=json_scalar(created['data']['oazDonorWriteV3'])
    expect(set(donor)=={'id','name'},'GraphQL donor write RPC returns only public fields',donor)
    changed=donor_command('update',donor['id'],{'name':'fake GraphQL changed'},1)
    expect(not changed.get('errors') and json_scalar(changed['data']['oazDonorWriteV3'])['name']=='fake GraphQL changed',
           'GraphQL donor RPC update confirms intended content',changed)
    for n in (3,5):
        blocked=donor_command('delete',donor['id'],{},n)
        expect(bool(blocked.get('errors')) and blocked.get('data') is None,'GraphQL unauthorized donor RPC deletion blocked',blocked)
    removed=donor_command('delete',donor['id'],{},1)
    expect(not removed.get('errors') and json_scalar(removed['data']['oazDonorWriteV3'])['id']==donor['id'],
           'GraphQL donor RPC delete confirms the exact fake row',removed)

    # Existing table mutation uses only authorized INSERT columns and requests no private RETURNING fields.
    signup='mutation{insertIntoRegisteredMemberCollection(objects:[{uuid:"'+uid(9)+'",email:"graphql-new@example.invalid",name:"fake GraphQL signup",isManager:false}]){affectedCount}}'
    denied(signup,9,'GraphQL signup without verified approval rejected')
    saved=positive('mutation{oazApprovalAddV3(approvalName:"fake GraphQL approved",approvalEmail:"graphql-new@example.invalid")}',1,
                   'GraphQL approved email insertion succeeds without listing emails')
    expect(json_scalar(saved['oazApprovalAddV3'])=={'saved':True},'GraphQL approval RPC returns confirmation only',saved)
    joined=positive(signup,9,'GraphQL approved signup succeeds without broad SELECT')
    expect(joined['insertIntoRegisteredMemberCollection']['affectedCount']==1,'GraphQL signup inserts exactly one own fake member',joined)
    expect(sql("SELECT count(*) FROM public.registered_member WHERE uuid='"+uid(9)+"';")=='1',
           'GraphQL signup keeps existing member records and adds only own identity')
    context['graphql_http_tested']=True
