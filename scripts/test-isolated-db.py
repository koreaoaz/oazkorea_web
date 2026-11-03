"""New disposable loopback PostgreSQL; synthetic fixtures only. Never restores backups.
No host/DSN/password argument exists. All PG/Supabase credentials removed from child env.
Reuses the previously reviewed official EDB archive without installing a service.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import socket
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_HASH = 'e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2'
ARCHIVES = {ARCHIVE_HASH: '18.6', 'd378882abd001a186735acd6f6ba716bca6ccd192e800412d4fd15ed25376b3e': '17.6'}


def run(archive, work, privacy_only=False, privacy_v3=False, postgrest=None,graphql=False,auto_grants='on'):
    if not privacy_v3: raise ValueError("Hotfix harness supports only --privacy-v3")
    work=work.resolve()
    if work==ROOT or ROOT in work.parents:
        raise ValueError('Synthetic clusters must stay outside the Git repository')
    with archive.open('rb') as archive_file:
        digest=hashlib.file_digest(archive_file, 'sha256').hexdigest()
        if digest not in ARCHIVES:
            raise ValueError('Reviewed official archive hash mismatch')
    version=ARCHIVES[digest]
    work.mkdir(parents=True, exist_ok=True)
    portable = work / ('official-'+version)
    fresh_portable=not portable.exists()
    if fresh_portable:
        portable.mkdir()
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            if not entry.filename.startswith(('pgsql/bin/', 'pgsql/lib/', 'pgsql/share/')):
                continue
            destination = (portable / entry.filename).resolve()
            if portable.resolve() not in destination.parents:
                raise ValueError('Unsafe archive path')
            if fresh_portable:
                z.extract(entry, portable)
            if not entry.is_dir():
                if not destination.is_file() or destination.is_symlink(): raise ValueError('Incomplete or unsafe portable cache')
                with z.open(entry) as expected, destination.open('rb') as actual:
                    if hashlib.file_digest(expected,'sha256').digest()!=hashlib.file_digest(actual,'sha256').digest():
                        raise ValueError('Portable file differs from reviewed official archive')
    binpath = portable / 'pgsql' / 'bin'
    lab = Path(tempfile.mkdtemp(prefix='synthetic-', dir=work))
    if graphql:
        if not privacy_v3:raise ValueError('GraphQL requires the P0 suite')
        bundle=ROOT.parent/'OAZ-Main-Lab/native-graphql/bundles'/('pg'+version.split('.')[0])
        manifest=json.loads((bundle/'manifest.json').read_text(encoding='utf-8'))
        if manifest.get('extension')!='pg_graphql' or manifest.get('version')!='1.6.3' or manifest.get('postgres_version')!=version or manifest.get('test_only') is not True:
            raise ValueError('Unreviewed local GraphQL bundle')
        if manifest.get('source_archive_sha256')!='1485880d5a5c27dca63a421c5d9911bbb9e437ee6fda9fb4a820ece31da1bcab':
            raise ValueError('GraphQL bundle source provenance mismatch')
        expected={'pg_graphql.dll','pg_graphql.control','pg_graphql--1.6.3.sql'}
        if set(manifest.get('files',{}))!=expected:raise ValueError('Incomplete GraphQL bundle')
        runtime=lab/'extension-runtime/pgsql'
        shutil.copytree(portable/'pgsql',runtime)
        for name,digest in manifest['files'].items():
            if (bundle/name).is_symlink() or hashlib.sha256((bundle/name).read_bytes()).hexdigest()!=digest:
                raise ValueError('Native GraphQL bundle integrity failure')
            target=runtime/('lib' if name.endswith('.dll') else 'share/extension')/name
            shutil.copyfile(bundle/name,target)
        binpath=runtime/'bin'
    env = {k:v for k,v in os.environ.items() if k.upper() in ('PATH','SYSTEMROOT','COMSPEC','TEMP','TMP','USERPROFILE')}
    env['PGCLIENTENCODING'] = 'UTF8'
    (lab/'empty-password-file').touch()
    env['PGPASSFILE']=str(lab/'empty-password-file')
    with socket.socket() as s:
        s.bind(('127.0.0.1',0)); port = s.getsockname()[1]
    if port == 5432:
        raise ValueError('Production port forbidden')
    def process(args, **kw):
        return subprocess.run([str(a) for a in args], capture_output=True, text=True, encoding='utf-8', env=env, timeout=90, **kw)
    def must(p, stage):
        if p.returncode:
            # Contains only synthetic fixture SQL. Private diagnostic never printed.
            (lab/'failure-private.txt').write_text(p.stderr,encoding='utf-8')
            raise RuntimeError(stage+' failed; inspect local synthetic diagnostic')
        return p.stdout.strip()
    if ' '+version not in must(process([binpath/'postgres.exe','--version']),'server binary version'):
        raise ValueError('Server binary version mismatch')
    must(process([binpath/'initdb.exe','-D',lab/'data','-U','oaz_synthetic','--auth=trust','--encoding=UTF8','--no-locale']), 'initdb')
    started = False
    passed = 0
    def sql(text, ok=True):
        p = process([binpath/'psql.exe','-X','-w','-h','127.0.0.1','-p',port,'-U','oaz_synthetic','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'], input=text)
        if ok:
            return must(p, 'SQL')
        return p.returncode != 0
    def check(condition, label):
        nonlocal passed
        if not condition: raise AssertionError(label)
        passed += 1
        print('PASS '+label, flush=True)
    def identity(n, email='member@example.invalid', aal='aal1'):
        return "SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-4000-8000-%012d'; SET request.jwt.claims='%s';" % (n,json.dumps({'email':email,'aal':aal}))
    try:
        # Windows server children can retain PIPE handles. Use a local file for
        # pg_ctl startup, not communicate()/capture_output, and always stop it.
        started = True
        with (lab/'startup.log').open('w',encoding='utf-8') as startup:
            startup_result=subprocess.run([str(binpath/'pg_ctl.exe'),'-D',str(lab/'data'),'-l',str(lab/'server.log'),'-o',
              f'-h 127.0.0.1 -p {port} -c max_connections=20 -c logging_collector=off','-w','start'],
              stdin=subprocess.DEVNULL,stdout=startup,stderr=startup,env=env,timeout=60)
        if startup_result.returncode: raise RuntimeError('Synthetic server start failed')
        actual_version=sql('SHOW server_version;')
        if actual_version!=version:raise ValueError('Running server version differs from pinned archive')
        if privacy_v3:
            from privacy_v3_regression import run_privacy_v3
            context={'port':port,'lab':lab,'env':env,'binpath':binpath,'graphql':graphql,'auto_grants':auto_grants}
            run_privacy_v3(sql,check,identity,ROOT,postgrest,context)
            result={'synthetic_only':True,'production_connected':False,'server_version':actual_version,
                    'passed':passed,'failed':0,'backup_restored':False,'http_tested':postgrest is not None,
                    'supabase_auth_provider_tested':False,'graphql_tested':context.get('graphql_http_tested',False),'auto_grants':auto_grants}
            (lab/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            print(json.dumps(result),flush=True)
            return
    finally:
        if started:
            must(process([binpath/'pg_ctl.exe','-D',lab/'data','-m','fast','-w','stop']), 'server shutdown')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive',type=Path,required=True)
    parser.add_argument('--work',type=Path,required=True)
    parser.add_argument('--privacy-only',action='store_true',help='Only P0 privacy and legacy compatibility, no other migrations')
    parser.add_argument('--privacy-v3',action='store_true',help='P0 minimum projection and default-deny capability suite')
    parser.add_argument('--postgrest',type=Path,help='Pinned official PostgREST archive; loopback fixture HTTP only')
    parser.add_argument('--graphql',action='store_true',help='Load reviewed locally compiled actual pg_graphql, never a mock')
    parser.add_argument('--auto-grants',choices=['on','off'],default='on',help='Synthetic public default-grant fixture mode')
    args=parser.parse_args()
    run(args.archive,args.work,args.privacy_only,args.privacy_v3,args.postgrest,args.graphql,args.auto_grants)
