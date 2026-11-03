"""User-run catalog seal only. Default plan never connects. No SQL/file/DSN/secret arguments."""
import argparse
from datetime import datetime,timezone
import getpass
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import uuid
import warnings

ROOT=Path(__file__).resolve().parents[1]
EXPECTED_MAIN_REF='maoefmwpdcnugyenyiea'
SURFACE_SHA256='9bba0473a15467646c9d3135012d54851e58a071357d2214dd548402f7f353ec'
QUERY_SHA256='68050cc8bcb6c2977f8efe419cb812ff72cae6162fd4365876c920d8a96e6e5c'


def approved_query():
    text=(ROOT/'reports/main-safety/integration/sql/010-catalog-fingerprint.sql').read_text(encoding='utf-8')
    if hashlib.sha256(text.encode()).hexdigest()!=QUERY_SHA256:raise ValueError('Unreviewed catalog template')
    return text


def collect(tools,env,base,runner=subprocess.run):
    base.require_db_guards(env);base.require_audited_clients(tools)
    query="""BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SELECT CASE WHEN current_setting('transaction_read_only')='on' AND current_database()='postgres'
 AND session_user='postgres' THEN 1 ELSE 0 END;
"""+approved_query()+"\nROLLBACK;\n"
    p=runner([tools['psql'],'-X','--no-password','--no-psqlrc','--dbname=postgres','-qAt','--set=ON_ERROR_STOP=1'],
        input=query.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=60)
    if p.returncode or p.stderr.strip():raise ValueError('Catalog check failed; no retry; diagnostics suppressed')
    lines=p.stdout.decode('utf-8').strip().splitlines()
    if len(lines)!=2 or lines[0]!='1' or not re.fullmatch('[0-9a-f]{64}',lines[1]):raise ValueError('Unexpected read-only/target response')
    return lines[1]


def approved_surface():
    text=(ROOT/'reports/main-safety/integration/sql/010-api-surface-readonly.sql').read_text(encoding='utf-8')
    if hashlib.sha256(text.encode()).hexdigest()!=SURFACE_SHA256:raise ValueError('Unreviewed API inventory template')
    return text[text.index('WITH scopes AS ('):text.rindex('ROLLBACK;')]


def collect_surface(tools,env,base,runner=subprocess.run):
    """Fixed catalog-only counts/version/default ACL; save privately, never print raw results."""
    body=approved_surface()
    base.require_db_guards(env);base.require_audited_clients(tools)
    query="BEGIN READ ONLY; SET LOCAL search_path=pg_catalog; SELECT CASE WHEN current_setting('transaction_read_only')='on' AND current_database()='postgres' AND session_user='postgres' THEN 1 ELSE 0 END;\n"+body+'\nROLLBACK;'
    p=runner([tools['psql'],'-X','--no-password','--no-psqlrc','--dbname=postgres','-qAt','--set=ON_ERROR_STOP=1'],
        input=query.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=60)
    if p.returncode or p.stderr.strip():raise ValueError('API inventory failed; no retry; diagnostics suppressed')
    lines=p.stdout.decode('utf-8').strip().splitlines()
    if len(lines)!=2 or lines[0]!='1':raise ValueError('Unexpected inventory transaction/target response')
    result=json.loads(lines[1])
    if not isinstance(result,dict) or set(result)!={'schema_role_inventory','graphql_extension','default_acl_inventory'}:
        raise ValueError('Unexpected inventory fields')
    if not isinstance(result['schema_role_inventory'],list) or not result['schema_role_inventory']:
        raise ValueError('Missing API roles/schema evidence')
    return result


def collect_evidence(tools,env,base):
    """No retries. Separate read-only sessions; reject observed drift, not an atomic snapshot."""
    connection=base.preflight(tools,env)
    before=collect(tools,env,base)
    surface=collect_surface(tools,env,base)
    after=collect(tools,env,base)
    if before!=after:raise ValueError('Catalog changed during collection; no approval or retry')
    return before,surface,connection


def release_hashes():
    sql=ROOT/'reports/main-safety/integration/sql'
    names=['010-preflight.sql','010-api-guard.sql','010-privacy-minimal.sql',
           '010-postcheck.sql','010-recovery.sql','015-resume-reviewed-graphql.sql']
    return {name:hashlib.sha256((sql/name).read_bytes()).hexdigest() for name in names}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['plan','check'],nargs='?',default='plan')
    action=parser.parse_args().action
    approved_query()
    approved_surface()
    artifacts=release_hashes()
    if action=='plan':
        print('No connection made. API-guarded candidate supports public and reviewed public+graphql_public. A digest alone never approves GraphQL/version/configuration. check requires a private local terminal, Main target confirmation and SSL verify-full.');return
    if not sys.stdin.isatty():raise ValueError('Private interactive terminal required')
    backup_root=ROOT.parent/'OAZ-Main-Backup'
    spec=importlib.util.spec_from_file_location('oaz_backup_readonly',backup_root/'backup.py')
    base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
    if base.MAIN_PROJECT_REF!=EXPECTED_MAIN_REF:raise ValueError('Backup target differs from reviewed Main project')
    if input('Confirm Main project ref from Dashboard: ').strip()!=base.MAIN_PROJECT_REF:raise ValueError('Wrong project')
    ca=input('Downloaded SSL CA certificate path: ').strip();base.validate_ca(ca)
    if input('Type oaz_web_main/P0-CATALOG-READONLY: ').strip()!='oaz_web_main/P0-CATALOG-READONLY':raise ValueError('Not confirmed')
    tools=base.tools_at(backup_root/'clients-edb-18.6-5/pgsql/bin')
    with warnings.catch_warnings():
        warnings.simplefilter('error',getpass.GetPassWarning)
        secret=getpass.getpass('DB password (hidden local input): ')
    env=base.db_environment(base.MAIN_PROJECT_REF,base.MAIN_POOLER_HOST,'postgres.'+base.MAIN_PROJECT_REF,'5432',ca,secret)
    secret=None
    try:
        observed,surface,connection=collect_evidence(tools,env,base)
        if release_hashes()!=artifacts:raise ValueError('Local SQL changed during collection; no approval')
    finally:env.clear()
    output=backup_root/('catalog-check-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-')+uuid.uuid4().hex[:8])
    base.restricted_directory(output)
    with (output/'seal.json').open('x',encoding='utf-8') as f:
        json.dump({'project':'oaz_web_main','project_ref':EXPECTED_MAIN_REF,
          'collected_at_utc':datetime.now(timezone.utc).isoformat(),
          'catalog_sha256':observed,'query_sha256':QUERY_SHA256,
          'surface_query_sha256':SURFACE_SHA256,
          'connection_metadata':connection,'release_sha256':artifacts,
          'catalog_unchanged_during_collection':True,'atomic_snapshot':False,
          'read_only':True,'ssl_verify_full':True,'automatic_policy_or_business_approval':False},f,indent=2)
    with (output/'surface.json').open('x',encoding='utf-8') as f:json.dump(surface,f,indent=2)
    print('Read-only catalog seal saved outside Git: '+output.name+'/seal.json')
    print('Private API extension/permission metadata saved beside the seal; no user rows or function bodies.')
    print('This digest is not approval. No policy was changed.')


if __name__=='__main__':
    try:main()
    except (Exception,KeyboardInterrupt):
        print('STOP: catalog check incomplete; no retry; raw diagnostics suppressed.',file=sys.stderr)
        sys.exit(1)
