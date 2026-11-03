"""Rebuild only P0 v3 SQL artifacts. No connections, credentials or migrations."""
from pathlib import Path
import re

SQL=Path(__file__).resolve().parents[1]/'reports/main-safety/integration/sql'


def assemble():
    pre=(SQL/'010-preflight.sql').read_text(encoding='utf-8')
    body=(SQL/'010-body.sql').read_text(encoding='utf-8')
    post=(SQL/'010-postcheck.sql').read_text(encoding='utf-8')
    checks=lambda text,name:re.search(rf'DO \${name}\$.*?END \${name}\$;',text,re.S).group()
    api=checks((SQL/'010-api-guard.sql').read_text(encoding='utf-8'),'privacy3_api')
    precheck=api+'\n'+checks(pre,'privacy3_preflight')
    postcheck=api+'\n'+checks(post,'privacy3_postcheck')
    contract="""
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
"""
    apply='-- P0 v3.1 API-guarded candidate: public OR public+graphql_public. Historical 001/010 drafts must not be combined.\n-- Actual GraphQL engine/wrapper checks and fresh catalog seal required. Never misdeclare Dashboard settings.\nBEGIN;\nSET LOCAL lock_timeout=\'5s\';\n'
    apply+=precheck+"\nLOCK TABLE public.registered_member,public.allowed_user,public.supervisor_id,public.who_is_boss,public.editor_5_donators IN ACCESS EXCLUSIVE MODE;\n"
    apply+=precheck+'\n'  # Recheck the seal after acquiring locks, before any mutation.
    apply+="SET LOCAL oaz.privacy_v3_assembly='verified-locked';\n"
    apply+=body+'\n'+contract+'\n'+postcheck+'\nCOMMIT;\n'
    enable="""-- Separate rollout gate. No privacy capabilities are granted.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_setting('oaz.approve_donor_v3_enable',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'P0_STOP: verified v3 code/API rollout approval required';
 END IF;
END $$;
"""+postcheck+"""
GRANT EXECUTE ON FUNCTION public.oaz_donor_write_v3(text,bigint,jsonb) TO authenticated;
UPDATE oaz_privacy_v3.state SET donor_writes=true WHERE id;
COMMIT;
"""
    approval_enable=enable.replace('oaz.approve_donor_v3_enable','oaz.approve_approval_v3_enable').replace('GRANT EXECUTE ON FUNCTION public.oaz_donor_write_v3(text,bigint,jsonb)','GRANT EXECUTE ON FUNCTION public.oaz_approval_add_v3(text,text)').replace('donor_writes=true','approval_writes=true')
    approval_enable=approval_enable.replace('UPDATE oaz_privacy_v3.state',"""DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
 WHERE i.indrelid='public.allowed_user'::regclass AND i.indisunique AND i.indisvalid AND i.indnkeyatts=1
 AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname='email') THEN
  RAISE EXCEPTION 'P0_STOP: existing unique approval-email contract required';
 END IF;
END $$;
UPDATE oaz_privacy_v3.state""")
    reads_enable="""-- Only after incident review; does not assign capabilities or enable writes.
BEGIN;
DO $$ BEGIN
 IF current_setting('oaz.approve_privacy_v3_reads',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'P0_STOP: separately reviewed private read recovery required';
 END IF;
END $$;
"""+postcheck+"""
GRANT EXECUTE ON FUNCTION public.oaz_privacy_editor_list_v3(text),public.oaz_member_self_v3() TO authenticated;
COMMIT;
"""
    graphql_resume="""-- Only after separate GraphQL incident review. No private table grants are restored.
BEGIN;
DO $$ BEGIN
 IF current_setting('oaz.approve_graphql_v3_resume',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'P0_STOP: separately reviewed GraphQL resumption required';
 END IF;
 UPDATE oaz_privacy_v3.api_contract SET settings=jsonb_set(settings,'{graphql_paused}','false') WHERE id;
 IF to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)') IS NOT NULL THEN
  GRANT EXECUTE ON FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) TO anon,authenticated;
 END IF;
END $$;
"""+postcheck+"\nCOMMIT;\n"
    return {'010-preflight.sql':'-- Generated with 010-api-guard.sql. Metadata only.\nBEGIN READ ONLY;\n'+precheck+'\nROLLBACK;\n',
            '010-postcheck.sql':'-- Generated with 010-api-guard.sql. Metadata only.\nBEGIN READ ONLY;\n'+postcheck+"\nSELECT 'P0_V3_POSTCHECK_PASS_METADATA_ONLY';\nROLLBACK;\n",
            '010-privacy-minimal.sql':apply,'011-enable-donor-writes.sql':enable,
            '012-enable-approval-writes.sql':approval_enable,'013-resume-reviewed-reads.sql':reads_enable,
            '015-resume-reviewed-graphql.sql':graphql_resume}


if __name__=='__main__':
    for name,text in assemble().items():(SQL/name).write_text(text,encoding='utf-8')
    print('P0 v3 SQL artifacts assembled offline; no database connection.')
