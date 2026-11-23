-- ADDITIVE CANDIDATE. Apply only after reviewed expand + auth/recovery migrations.
-- No managed role/password, exposed-schema list, signing key or existing RPC change.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('oaz.data_api_gateway_review',true) IS DISTINCT FROM 'reviewed-v1'
 OR to_regnamespace('oaz_gateway_v1') IS NOT NULL
 OR to_regprocedure('oaz_acceptance.super_recovery_claim(jsonb)') IS NULL
 THEN RAISE EXCEPTION 'GATEWAY_MIGRATION_REVIEW_REQUIRED';END IF;
END$$;
CREATE SCHEMA oaz_gateway_v1;
REVOKE ALL ON SCHEMA oaz_gateway_v1 FROM PUBLIC;
CREATE TABLE oaz_gateway_v1.config(id boolean PRIMARY KEY CHECK(id), gate_sha256 bytea NOT NULL CHECK(octet_length(gate_sha256)=32));
ALTER TABLE oaz_gateway_v1.config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oaz_gateway_v1.config FROM PUBLIC,anon,authenticated,service_role;
-- Empty configuration fails closed. Only an approved owner provisions the hash
-- of the existing 64-hex server gate; never a password/JWT/signing secret.
CREATE FUNCTION oaz_gateway_v1.assert_gate() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE supplied text; expected bytea;
BEGIN
 supplied:=current_setting('request.headers',true)::jsonb->>'x-oaz-server-gate';
 SELECT gate_sha256 INTO expected FROM oaz_gateway_v1.config WHERE id;
 IF current_setting('request.method',true) IS DISTINCT FROM 'POST'
 OR supplied IS NULL OR supplied !~ '^[a-f0-9]{64}$' OR expected IS NULL
 OR pg_catalog.sha256(pg_catalog.convert_to(supplied,'UTF8'))<>expected
 THEN RAISE insufficient_privilege USING MESSAGE='GATEWAY_DENIED';END IF;
END$$;
REVOKE ALL ON FUNCTION oaz_gateway_v1.assert_gate() FROM PUBLIC;
GRANT USAGE ON SCHEMA oaz_gateway_v1 TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION oaz_gateway_v1.assert_gate() TO anon,authenticated,service_role;
CREATE FUNCTION public.oaz_gateway_v1(route text, arguments jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM oaz_gateway_v1.assert_gate();
 IF current_user NOT IN ('anon','authenticated','service_role') OR jsonb_typeof(arguments) IS DISTINCT FROM 'object'
 OR octet_length(arguments::text)>180000 THEN RAISE insufficient_privilege USING MESSAGE='GATEWAY_DENIED';END IF;
 CASE route
 WHEN 'acceptance/accounts_manage' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.accounts_manage(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/accounts_service' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.accounts_service(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/enrollment_self' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.enrollment_self(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/enrollment_service' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.enrollment_service(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/honor_workflow' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.honor_workflow(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/image_access' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['bucket','path','preview']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.image_access((arguments->>'bucket')::text,(arguments->>'path')::text,CASE WHEN arguments ? 'preview' THEN (arguments->>'preview')::boolean ELSE false END));
 WHEN 'acceptance/image_withdraw' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['bucket','path']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.image_withdraw((arguments->>'bucket')::text,(arguments->>'path')::text));
 WHEN 'acceptance/invitation_accept' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.invitation_accept(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/invitation_manage' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.invitation_manage(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/invitation_service' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.invitation_service(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/login_identity' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.login_identity(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/mail_review' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.mail_review(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/site_manage' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.site_manage(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/site_public' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY[]::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.site_public());
 WHEN 'acceptance/trash_review' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.trash_review(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_account_recovery_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_account_recovery_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_admin_command_v2' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_admin_command_v2(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_admin_insights_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_admin_insights_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_attachment_access_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['document_id','preview']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_attachment_access_v1((arguments->>'document_id')::uuid,CASE WHEN arguments ? 'preview' THEN (arguments->>'preview')::boolean ELSE false END));
 WHEN 'server/oaz_attachment_command_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_attachment_command_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_final_command_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_final_command_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_honor_manage_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_honor_manage_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_media_approve_scoped_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['path']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_media_approve_scoped_v1((arguments->>'path')::text));
 WHEN 'server/oaz_media_reserve_scoped_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['bucket','object_name','byte_count','rights_confirmed']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_media_reserve_scoped_v1((arguments->>'bucket')::text,(arguments->>'object_name')::text,(arguments->>'byte_count')::integer,(arguments->>'rights_confirmed')::boolean));
 WHEN 'server/oaz_promotion_command_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_promotion_command_v1(nullif(arguments->'command','null'::jsonb)));
 WHEN 'server/oaz_public_attachments_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['tbl','rid']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_public_attachments_v1((arguments->>'tbl')::text,(arguments->>'rid')::bigint));
 WHEN 'server/oaz_public_content_meta_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['tbl','rid']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_public_content_meta_v1((arguments->>'tbl')::text,(arguments->>'rid')::bigint));
 WHEN 'server/oaz_public_honor_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY[]::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM oaz_server_api.oaz_public_honor_v1() t);
 WHEN 'server/oaz_public_study_sessions_v1' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY[]::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_server_api.oaz_public_study_sessions_v1());
 WHEN 'acceptance/password_identity' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.password_identity(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/password_manage' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.password_manage(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/password_service' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.password_service(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/super_recovery_service' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.super_recovery_service(nullif(arguments->'command','null'::jsonb)));
 WHEN 'acceptance/super_recovery_claim' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(arguments) k WHERE NOT (k=ANY(ARRAY['command']::text[]))) THEN RAISE invalid_parameter_value USING MESSAGE='GATEWAY_ARGUMENTS';END IF;
  RETURN to_jsonb(oaz_acceptance.super_recovery_claim(nullif(arguments->'command','null'::jsonb)));
 ELSE RAISE insufficient_privilege USING MESSAGE='GATEWAY_ROUTE_DENIED';
 END CASE;
END$$;
REVOKE ALL ON FUNCTION public.oaz_gateway_v1(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oaz_gateway_v1(text,jsonb) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
