"""Operator-run, read-only P0 preflight. Default plan is offline; no apply mode exists."""
import argparse
from datetime import datetime, timezone
import getpass
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
import warnings

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT.parent / 'OAZ-Main-Backup'
REF = 'maoefmwpdcnugyenyiea'
EVIDENCE = 'catalog-check-20261103T053221Z-eba7f9b5'
PRE_SHA = '6eb1737f45fb6c40f3e6e3cdd4d692243d72c69a846802c23ae8ab2c3c7c9585'
PREFIX = '-- Generated with 010-api-guard.sql. Metadata only.\nBEGIN READ ONLY;\n'
SUFFIX = '\nROLLBACK;\n'
PASS = 'P0_PREFLIGHT_PASS'
ROLLED_BACK = 'P0_ROLLBACK_COMPLETE'


def private_terminal():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        return False
    if os.name == 'nt':
        import ctypes
        import msvcrt
        for stream in (sys.stdin, sys.stdout):
            mode = ctypes.c_ulong()
            handle = msvcrt.get_osfhandle(stream.fileno())
            if not ctypes.windll.kernel32.GetConsoleMode(ctypes.c_void_p(handle), ctypes.byref(mode)):
                return False
    return True


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def approved_preflight():
    sql = (ROOT / 'reports/main-safety/integration/sql/010-preflight.sql').read_text(encoding='utf-8')
    if hashlib.sha256(sql.encode()).hexdigest() != PRE_SHA or not sql.startswith(PREFIX) or not sql.endswith(SUFFIX):
        raise ValueError('Unreviewed preflight SQL')
    return sql[len(PREFIX):-len(SUFFIX)]


def load_evidence(catalog):
    folder = BACKUP / EVIDENCE
    for path in (BACKUP, folder, folder / 'seal.json', folder / 'surface.json'):
        if not path.exists() or path.is_symlink() or getattr(path.stat(), 'st_file_attributes', 0) & 0x400:
            raise ValueError('Missing or redirected local evidence')
    seal = json.loads((folder / 'seal.json').read_text(encoding='utf-8'))
    surface = json.loads((folder / 'surface.json').read_text(encoding='utf-8'))
    if (seal.get('project') != 'oaz_web_main' or seal.get('project_ref') != REF or
        seal.get('read_only') is not True or seal.get('ssl_verify_full') is not True or
        seal.get('catalog_unchanged_during_collection') is not True or
        seal.get('connection_metadata', {}).get('server_version_num') != 170006 or
        seal.get('query_sha256') != catalog.QUERY_SHA256 or
        seal.get('surface_query_sha256') != catalog.SURFACE_SHA256 or
        seal.get('release_sha256') != catalog.release_hashes() or
        not re.fullmatch(r'[0-9a-f]{64}', seal.get('catalog_sha256', '')) or
        not isinstance(surface, dict) or set(surface) != {'schema_role_inventory', 'graphql_extension', 'default_acl_inventory'}):
        raise ValueError('Local evidence or SQL release mismatch')
    catalog.approved_query()
    catalog.approved_surface()
    approved_preflight()
    return seal['catalog_sha256']


def payload(seal):
    if not re.fullmatch(r'[0-9a-f]{64}', seal):
        raise ValueError('Invalid catalog digest')
    body = approved_preflight()
    return """BEGIN READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog;
DO $read_only_gate$
BEGIN
 IF current_setting('transaction_read_only') <> 'on' OR current_database() <> 'postgres'
    OR session_user <> 'postgres' OR current_user <> 'postgres' THEN
   RAISE EXCEPTION 'P0_STOP: read-only session or target mismatch';
 END IF;
 IF current_setting('server_version_num') <> '170006' THEN
   RAISE EXCEPTION 'P0_STOP: server version not reviewed';
 END IF;
 IF to_regnamespace('oaz_privacy_v3') IS NOT NULL THEN
   RAISE EXCEPTION 'P0_STOP: existing privacy installation needs separate review';
 END IF;
END $read_only_gate$;
SET LOCAL oaz.approve_privacy_v3='yes';
SET LOCAL oaz.privacy_surface_review_approved='yes';
SET LOCAL oaz.privacy_exposed_schemas='["public","graphql_public"]';
SET LOCAL oaz.privacy_extra_search_path='["public","extensions"]';
SET LOCAL oaz.privacy_auto_expose_new_tables='on';
SET LOCAL oaz.privacy_expected_catalog_sha256='""" + seal + """';
""" + body + "\nSELECT '" + PASS + "';\nROLLBACK;\nSELECT '" + ROLLED_BACK + "';\n"


def execute(tools, env, base, seal, runner=subprocess.run):
    base.require_db_guards(env)
    base.require_audited_clients(tools)
    result = runner([tools['psql'], '-X', '--no-password', '--no-psqlrc', '--dbname=postgres',
                     '-qAt', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=terse'],
                    input=payload(seal).encode(), env=env, stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, timeout=90)
    # Only reviewed fixed P0_STOP messages may be classified; never emit server text.
    if result.returncode:
        error = result.stderr.decode('utf-8', errors='replace')
        messages = re.findall(r"RAISE EXCEPTION 'P0_STOP: ([^']+)'", approved_preflight())
        messages += ['read-only session or target mismatch', 'server version not reviewed',
                     'existing privacy installation needs separate review']
        matches = [i for i, message in enumerate(messages) if ('P0_STOP: ' + message) in error]
        return ('P0_STOP', 'check_%02d' % matches[0]) if len(matches) == 1 else ('STOP', 'connection_or_sql_error')
    if result.stderr.strip() or result.stdout.decode('utf-8', errors='replace').splitlines() != [PASS, ROLLED_BACK]:
        return 'STOP', 'unexpected_output_or_missing_rollback'
    return 'PASS', 'read_only_preflight_and_rollback'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'check'], nargs='?', default='plan')
    action = parser.parse_args().action
    catalog = module('p0_catalog_reviewed', ROOT / 'scripts/privacy-catalog-check.py')
    seal = load_evidence(catalog)
    if action == 'plan':
        print('Offline plan: verified local SQL/evidence; no connection or policy change.')
        return 0
    if not private_terminal():
        raise ValueError('Private interactive terminal required')
    base = module('p0_readonly_backup', BACKUP / 'backup.py')
    if base.MAIN_PROJECT_REF != REF:
        raise ValueError('Unexpected configured Main target')
    base.restricted_directory(BACKUP)
    print('Read-only preflight only. No deployment or business approval is granted.')
    print('Review the private surface.json and current Dashboard API settings first.')
    print('Required Dashboard settings: public + graphql_public; search path public + extensions; auto expose ON.')
    if input('Confirm Main project ref: ').strip() != REF:
        raise ValueError('Wrong target')
    ca = input('Downloaded SSL CA certificate path: ').strip()
    base.validate_ca(ca)
    if input('Type REVIEWED-API-SURFACE after private review: ').strip() != 'REVIEWED-API-SURFACE':
        raise ValueError('Surface review not confirmed')
    if input('Type RUN-READONLY-PREFLIGHT: ').strip() != 'RUN-READONLY-PREFLIGHT':
        raise ValueError('Read-only execution not confirmed')
    tools = base.tools_at(BACKUP / 'clients-edb-18.6-5/pgsql/bin')
    output = BACKUP / ('p0-preflight-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8])
    base.restricted_directory(output)
    status, reason = 'STOP', 'incomplete'
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            secret = getpass.getpass('DB password (hidden local input): ')
        env = base.db_environment(REF, base.MAIN_POOLER_HOST, 'postgres.' + REF, '5432', ca, secret)
        secret = None
        try:
            connection = base.preflight(tools, env)
            if connection.get('server_version_num') != 170006:
                status, reason = 'P0_STOP', 'server_version_not_reviewed'
            elif load_evidence(catalog) != seal:
                status, reason = 'STOP', 'local_evidence_changed'
            else:
                status, reason = execute(tools, env, base, seal)
        finally:
            env.clear()
    except (Exception, KeyboardInterrupt):
        status, reason = 'STOP', 'authentication_tls_or_check_failure'
    report = {'status': status, 'reason': reason, 'at_utc': datetime.now(timezone.utc).isoformat(),
              'project': 'oaz_web_main', 'preflight_only': True, 'read_only_transaction_verified': status == 'PASS',
              'rollback_confirmed': status == 'PASS', 'policy_changed': False,
              'deployment_or_business_approval': False, 'production_apply_executed': False}
    with (output / 'result.json').open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    print(status + ': ' + reason + '. No policy was applied.')
    print('Private result: ' + output.name + '/result.json')
    return 0 if status == 'PASS' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (Exception, KeyboardInterrupt):
        print('STOP: preflight not completed; no retry; diagnostics suppressed.', file=sys.stderr)
        sys.exit(1)
