"""Real loopback PostgREST; random synthetic JWT signing key exists only in memory.
Not Supabase Auth or GitHub OAuth. No arbitrary endpoint/DSN/token arguments.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import socket
import subprocess
import time
import urllib.error
import urllib.request
import zipfile

POSTGREST_SHA256='17f595b0d8dd37473d0231417dea07c5ac9f791282ff5b017fae51ff29e5de2f'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


def run_http(sql,check,archive,context):
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=POSTGREST_SHA256:raise ValueError('Official PostgREST digest mismatch')
    lab=context['lab']; env=dict(context['env'])
    env['PATH']=str(context['binpath'])+os.pathsep+env.get('PATH','')
    with zipfile.ZipFile(archive) as z:
        if z.namelist()!=['postgrest.exe']:raise ValueError('Unexpected official archive structure')
        z.extract('postgrest.exe',lab)
    sql('CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon,authenticated TO authenticator;')
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    if port==5432:raise ValueError('Production port forbidden')
    key=secrets.token_hex(32)
    env.update(PGRST_DB_URI=f"postgresql://authenticator@127.0.0.1:{context['port']}/postgres",
        PGRST_DB_SCHEMAS='public,graphql_public' if context.get('graphql') else 'public',
        PGRST_DB_EXTRA_SEARCH_PATH='public,extensions',
        PGRST_DB_ANON_ROLE='anon',PGRST_SERVER_HOST='127.0.0.1',PGRST_SERVER_PORT=str(port),
        PGRST_JWT_SECRET=key,PGRST_DB_CONFIG='false',PGRST_DB_CHANNEL_ENABLED='false',PGRST_LOG_LEVEL='crit')
    def token(n=None,*,role='authenticated',expired=False,wrong=False,extra=None):
        def encode(v):return base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=')
        payload={'role':role,'exp':int(time.time())+(-60 if expired else 180),**(extra or {})}
        if n is not None:payload['sub']=f'00000000-0000-4000-8000-{n:012d}'
        payload['email']={1:'admin@example.invalid',2:'member@example.invalid',3:'other@example.invalid',4:'new@example.invalid',7:'http-new@example.invalid',9:'graphql-new@example.invalid'}.get(n,'synthetic@example.invalid')
        message=encode({'alg':'HS256','typ':'JWT'})+b'.'+encode(payload)
        signature=hmac.new(('wrong-synthetic-key' if wrong else key).encode(),message,hashlib.sha256).digest()
        return (message+b'.'+base64.urlsafe_b64encode(signature).rstrip(b'=')).decode()
    def request(path,jwt=None,payload=None,*,profile=None):
        # Constructed URL is fixed loopback; callers can supply paths only.
        if not path.startswith('/') or '://' in path:raise ValueError('Invalid local path')
        headers={'Content-Type':'application/json'}
        if profile is not None:
            if profile not in ('graphql_public','extensions'):raise ValueError('Unreviewed local API profile')
            headers.update({'Content-Profile':profile,'Accept-Profile':profile})
        if jwt:headers['Authorization']='Bearer '+jwt
        req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,headers=headers,
            data=None if payload is None else json.dumps(payload).encode(),method='GET' if payload is None else 'POST')
        try:
            with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(req,timeout=3) as r:
                raw=r.read();return r.status,json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw=e.read()
            try:return e.code,json.loads(raw)
            except ValueError:return e.code,None
    process=None
    try:
        with (lab/'http-synthetic.log').open('wb') as log:
            process=subprocess.Popen([str(lab/'postgrest.exe')],env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            for _ in range(100):
                if process.poll() is not None:raise RuntimeError('Local PostgREST startup failed; synthetic diagnostic kept private')
                try:
                    status,_=request('/editor_5_donators?select=id,name')
                    if status==200:break
                except (OSError,TimeoutError):pass
                time.sleep(.1)
            else:raise RuntimeError('Local PostgREST readiness timeout')
            check(True,'real PostgREST loopback server ready')
            # Execute the actual hotfix TypeScript service against this real local API.
            from pathlib import Path
            root=Path(__file__).resolve().parents[1]
            for actor,n in [('approved',2),('ordinary',3)]:
                client_env=dict(context['env'])
                client_env.update(OAZ_FIXTURE_ORIGIN=f'http://127.0.0.1:{port}/',OAZ_FAKE_JWT=token(n),OAZ_FIXTURE_ACTOR=actor)
                client=subprocess.run(['node',str(root/'scripts/hotfix-local-client.mjs')],env=client_env,
                    cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
                client_env.clear()
                if client.returncode:
                    (lab/'hotfix-client-private.log').write_bytes(client.stderr)
                    raise RuntimeError('Hotfix local client regression failed; synthetic diagnostic kept outside Git')
                summary=json.loads(client.stdout)
                check(summary.get('failed')==0 and summary.get('production_connected') is False,'actual hotfix client '+actor+' agrees with local protected database')
            if context.get('graphql'):
                from privacy_graphql_regression import run_http_graphql
                run_http_graphql(sql,check,request,token,context)
            for path in ('/registered_member?select=email','/allowed_user?select=email','/supervisor_id?select=uuid','/who_is_boss?select=uuid','/editor_5_donators?select=uuid'):
                for jwt,label in [(None,'anonymous'),(token(role='anon'),'signed anon')]:
                    check(request(path,jwt)[0] in (401,403),'HTTP '+label+' private projection denied '+path.split('?')[0])
            status,rows=request('/editor_5_donators?select=id,name')
            check(status==200 and all(set(r)=={'id','name'} for r in rows),'HTTP public donor projection exact')
            status,old_rows=request('/editor_5_donators?select=*',token(1))
            check(status==403 or status==200 and all(set(r)<= {'id','name'} for r in old_rows),'HTTP old wildcard client cannot reopen private donor columns')
            check(request('/rpc/oaz_donator_admin_list_v2',token(1),{})[0]==404,'HTTP old RPC version fails closed after v3-only installation')
            for n,other in [(3,4),(4,3)]:
                jwt=token(n)
                status,rows=request(f'/registered_member?select=uuid&uuid=eq.00000000-0000-4000-8000-{other:012d}',jwt)
                check(status==200 and rows==[],'HTTP signed user cross-member filter denied '+str(n))
                check(request('/registered_member?select=phone_number,email,student_id',jwt)[0]==403,'HTTP private column projection denied '+str(n))
                status,profile=request('/rpc/oaz_member_self_v3',jwt,{})
                check(status==200 and set(profile)=={'name','department','generation'},'HTTP own profile minimum contract '+str(n))
                check(request('/rpc/oaz_privacy_editor_list_v3',jwt,{'board':'registered_member'})[0]==403,'HTTP ordinary user cannot call directory RPC '+str(n))
            # Use the valid bodyless GET form of this STABLE read RPC to isolate JWT
            # rejection from Windows early-response/unread POST-body connection resets.
            # No retry or connection error is accepted as an authorization result.
            check(request('/rpc/oaz_member_self_v3',token(3))[0]==200,'HTTP bodyless JWT probe has a valid positive control')
            for jwt,label in [(token(3,wrong=True),'wrong signature'),(token(3,expired=True),'expired'),('malformed.invalid.jwt','malformed')]:
                check(request('/rpc/oaz_member_self_v3',jwt)[0]==401,'HTTP JWT rejected '+label)
            check(request('/rpc/oaz_privacy_editor_list_v3',token(3,extra={'capabilities':['members.read'],'user_metadata':{'role':'SUPER_ADMIN'}}),{'board':'registered_member'})[0]==403,'HTTP forged metadata/capability never grants PII')
            check(request('/registered_member?select=uuid',token(3,role='oaz_synthetic'))[0]==403,'HTTP authenticator cannot assume ungranted owner role')
            check(request('/rpc/oaz_privacy_editor_list_v3',token(1),{'board':'registered_member'})[0]==403,'HTTP super admin has no automatic member capability')
            admin2_jwt=token(2)
            status,result=request('/rpc/oaz_privacy_editor_list_v3',admin2_jwt,{'board':'registered_member'})
            check(status==200 and all(set(r)=={'id','name','department','generation'} for r in result['rows']),'HTTP explicit admin2 capability minimum rows')
            sql("UPDATE oaz_admin_v2.assignments SET status='disabled' WHERE slot='admin2';")
            check(request('/rpc/oaz_privacy_editor_list_v3',admin2_jwt,{'board':'registered_member'})[0]==403,'HTTP disabled admin denied using identical signed JWT')
            sql("UPDATE oaz_admin_v2.assignments SET status='active',revision=2 WHERE slot='admin2';")
            check(request('/rpc/oaz_privacy_editor_list_v3',admin2_jwt,{'board':'registered_member'})[0]==403,'HTTP stale assignment revision invalidates identical JWT capability')
            status,row=request('/rpc/oaz_donor_write_v3',token(1),{'operation':'create','record_id':None,'payload':{'name':'fake HTTP donor'}})
            check(status==200 and set(row)=={'id','name'},'HTTP donor name-only create succeeds')
            check(request('/rpc/oaz_donor_write_v3',token(1),{'operation':'update','record_id':row['id'],'payload':{'date':'2026-01-01'}})[0]==400,'HTTP donor private payload rejected')
            check(request('/rpc/oaz_donor_write_v3',token(3),{'operation':'delete','record_id':row['id'],'payload':{}})[0]==403,'HTTP ordinary donor mutation denied')
            check(request('/rpc/oaz_donor_write_v3',token(1),{'operation':'delete','record_id':row['id'],'payload':{}})[0]==200,'HTTP donor public delete succeeds')
            check(request('/rpc/oaz_privacy_editor_list_v3',token(1),{'board':'who_is_boss'})[0]==403,'HTTP unsupported boss route fails closed')
            status,value=request('/rpc/oaz_approval_add_v3',token(1),{'approval_name':'fake','approval_email':'http-approved@example.invalid'})
            check(status==200 and value=={'saved':True},'HTTP approved worker adds email without reading the approval directory')
            check(request('/rpc/oaz_approval_add_v3',token(1),{'approval_name':'fake','approval_email':'http-approved@example.invalid'})[0]==409,'HTTP duplicate approval returns conflict')
            check(request('/rpc/oaz_approval_add_v3',token(3),{'approval_name':'fake','approval_email':'http-forged@example.invalid'})[0]==403,'HTTP ordinary member cannot self-approve')
            sql("UPDATE auth.users SET email='http-new@example.invalid' WHERE id='00000000-0000-4000-8000-000000000007'; INSERT INTO allowed_user(email,name) VALUES('http-new@example.invalid','fake');")
            status,_=request('/registered_member',token(7),{'uuid':'00000000-0000-4000-8000-000000000007','email':'http-new@example.invalid','name':'fake HTTP signup','is_manager':False})
            check(status==201,'HTTP approved signup INSERT works without public email list')
            status,rows=request('/registered_member?select=uuid',token(7))
            check(status==200 and len(rows)==1,'HTTP callback own UUID query works after signup')
            check(request('/registered_member',token(8),{'uuid':'00000000-0000-4000-8000-000000000008','email':'synthetic@example.invalid','is_manager':False})[0]==403,'HTTP unapproved signup rejected by DB RLS')
    finally:
        env.clear();key=None
        if process:
            before_cleanup=process.poll()
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
            (lab/'http-lifecycle.json').write_text(json.dumps({'before_cleanup_exit':before_cleanup,'after_cleanup_exit':process.returncode}),encoding='utf-8')
            check(process.poll() is not None,'owned local PostgREST process stopped')
