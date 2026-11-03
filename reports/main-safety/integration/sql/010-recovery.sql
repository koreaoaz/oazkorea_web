-- Fail closed. No grants/policies/data are restored to an exposed state.
BEGIN;
DO $$ BEGIN
 IF current_setting('oaz.approve_privacy_v3_recovery',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'Explicit safe recovery approval required';
 END IF;
END $$;
UPDATE oaz_privacy_v3.state SET donor_writes=false,approval_writes=false WHERE id;
UPDATE oaz_privacy_v3.api_contract SET settings=jsonb_set(settings,'{graphql_paused}','true') WHERE id;
-- A private RPC flag alone cannot contain a corrupted GraphQL entry point.
-- Pause API execution (including inherited grantees) without changing its body or table policies.
DO $$ DECLARE target oid:=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)'); g record; BEGIN
 IF target IS NOT NULL THEN
  FOR g IN SELECT DISTINCT a.grantee FROM pg_proc p,
    LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=target
    AND CASE WHEN a.grantee=0 THEN true ELSE
      pg_has_role('anon',a.grantee,'MEMBER') OR pg_has_role('authenticated',a.grantee,'MEMBER') END LOOP
   EXECUTE 'REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) FROM '||
     CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE quote_ident(g.grantee::regrole::text) END;
  END LOOP;
  REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
  IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('authenticated',target,'EXECUTE') THEN
   RAISE EXCEPTION 'P0_STOP: privileged GraphQL owner/membership needs manual incident containment';
  END IF;
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.oaz_donor_write_v3(text,bigint,jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.oaz_approval_add_v3(text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.oaz_privacy_editor_list_v3(text),public.oaz_member_self_v3() FROM authenticated;
COMMIT;
