-- Local/isolated application only until separate Production SQL approval.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF current_setting('oaz.honor_crud_review',true) IS DISTINCT FROM 'reviewed-v2'
 OR to_regprocedure('oaz_acceptance.honor_workflow(jsonb)') IS NULL
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR to_regprocedure('oaz_final.actor(boolean)') IS NULL
 OR to_regclass('oaz_final.server_rpc_contract') IS NULL
 OR to_regclass('oaz_honor_v1.managers') IS NOT NULL
 OR EXISTS(SELECT FROM information_schema.columns WHERE table_schema='oaz_honor_v1' AND table_name='publications' AND column_name='direct_public')
 THEN RAISE EXCEPTION 'HONOR_CRUD_REVIEW_REQUIRED';END IF;
 -- Original functions stay private. The preserved SECURITY DEFINER wrappers
 -- must still provide the public/member entry points before any DDL is applied.
 IF NOT coalesce(has_function_privilege('anon','oaz_server_api.oaz_public_honor_v1()','EXECUTE'),false)
 OR NOT coalesce(has_function_privilege('authenticated','oaz_server_api.oaz_public_honor_v1()','EXECUTE'),false)
 OR NOT coalesce(has_function_privilege('authenticated','oaz_server_api.oaz_honor_manage_v1(jsonb)','EXECUTE'),false)
 OR (SELECT count(*) FROM pg_proc WHERE oid IN (to_regprocedure('oaz_server_api.oaz_public_honor_v1()'),to_regprocedure('oaz_server_api.oaz_honor_manage_v1(jsonb)')) AND prosecdef AND pg_get_userbyid(proowner)='postgres')<>2
 OR (SELECT count(*) FROM oaz_final.server_rpc_contract WHERE signature IN ('oaz_public_honor_v1()','oaz_honor_manage_v1(jsonb)'))<>2
 THEN RAISE EXCEPTION 'HONOR_WRAPPER_CONTRACT_REQUIRED';END IF;
END$$;
ALTER TABLE oaz_honor_v1.publications ADD COLUMN direct_public boolean NOT NULL DEFAULT false;
-- Explicit owner-managed delegation. No ordinary administrator is auto-authorized.
CREATE TABLE oaz_honor_v1.managers(user_id uuid PRIMARY KEY REFERENCES auth.users(id),granted_by uuid NOT NULL REFERENCES auth.users(id),granted_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE oaz_honor_v1.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oaz_honor_v1.managers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON oaz_honor_v1.managers FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.oaz_honor_manage_v1(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a oaz_admin_v2.assignments; av bigint; v bigint; act text:=command->>'action';
 req uuid; fp text; receipt oaz_honor_v1.receipts; result jsonb; rid bigint; p oaz_honor_v1.publications;
 n text; gen text; aff text; intro text; pos integer; old_status text; new_status text;
 original jsonb; z oaz_honor_v1.deletions; changed boolean; allowed text[]; ordered record;
BEGIN
 SELECT version INTO av FROM oaz_admin_v2.state WHERE id FOR UPDATE;
 a:=oaz_final.actor();
 -- Dedicated explicit honor delegation; existing board scopes grant no honor access.
 IF NOT coalesce((a.role='SUPER_ADMIN' AND a.slot='admin1' AND auth.jwt()->>'aal'='aal2') OR (a.role='ADMIN' AND EXISTS(SELECT FROM oaz_honor_v1.managers m WHERE m.user_id=a.user_id)),false) THEN RAISE insufficient_privilege; END IF;
 IF jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>16384 OR act IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023';END IF;
 allowed:=CASE act
 WHEN 'list' THEN ARRAY[]::text[] WHEN 'trash' THEN ARRAY[]::text[]
 WHEN 'create' THEN ARRAY['version','name','generation','affiliation','introduction','position']
 WHEN 'save' THEN ARRAY['version','id','revision','displayName','generation','affiliation','introduction','position']
 WHEN 'delete' THEN ARRAY['version','id','revision','confirmed']
 WHEN 'restore' THEN ARRAY['version','trashId','revision','confirmed']
 END;
 IF allowed IS NULL OR EXISTS(SELECT FROM jsonb_object_keys(command) k WHERE NOT k=ANY(allowed||ARRAY['action','requestId'])) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 req:=(command->>'requestId')::uuid;
 IF req IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED' USING ERRCODE='22023';END IF;
 SELECT version INTO v FROM oaz_honor_v1.state WHERE id FOR UPDATE;
 IF a.role<>'SUPER_ADMIN' AND act IN ('trash','restore') THEN RAISE insufficient_privilege;END IF;
 IF act='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.position,q.id),'[]') INTO result FROM (
   SELECT d.id,d.name,coalesce(h.display_name,d.name) display_name,coalesce(h.revision,0) revision,
    coalesce(h.generation,'') generation,coalesce(h.affiliation,'') affiliation,coalesce(h.introduction,'') introduction,
    coalesce(o.position,0) position,d.created_at,h.updated_at,
    CASE WHEN h.direct_public THEN 'approved' WHEN h.review_required OR h.approved_at IS NOT NULL AND h.approved_by IS NULL THEN 'pending'
     WHEN h.revoked_at IS NOT NULL THEN 'revoked' WHEN h.approved_at IS NOT NULL THEN 'approved' ELSE 'draft' END status
   FROM public.editor_5_donators d LEFT JOIN oaz_honor_v1.publications h ON h.donator_id=d.id
   LEFT JOIN oaz_admin_v2.orders o ON o.table_name='editor_5_donators' AND o.record_id=d.id
   WHERE (a.role='SUPER_ADMIN' OR h.direct_public OR (h.approved_at<=statement_timestamp() AND h.approved_by IS NOT NULL AND h.consent_reference IS NOT NULL AND h.revoked_at IS NULL AND NOT h.review_required)) AND NOT EXISTS(SELECT FROM oaz_honor_v1.deletions x WHERE x.donator_id=d.id AND x.restored_at IS NULL)
  ) q;
  RETURN jsonb_build_object('policy','simple-crud-v2','version',v,'superAdmin',a.role='SUPER_ADMIN','canManage',true,'rows',result,'requests','[]'::jsonb);
 ELSIF act='trash' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('trashId',id,'id',donator_id,'name',original_row->>'name','revision',revision,'deletedAt',deleted_at,'retainUntil',retain_until,'status','deleted') ORDER BY deleted_at DESC),'[]') INTO result FROM oaz_honor_v1.deletions WHERE restored_at IS NULL;
  RETURN jsonb_build_object('policy','simple-crud-v2','version',v,'superAdmin',a.role='SUPER_ADMIN','canManage',true,'rows',result,'requests','[]'::jsonb);
 END IF;
 fp:=encode(sha256(convert_to('honor-crud-v2:'||command::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM oaz_honor_v1.receipts WHERE request_id=req;
 IF receipt.request_id IS NOT NULL THEN
  IF receipt.actor_id<>a.user_id OR receipt.fingerprint<>fp THEN RAISE EXCEPTION 'RETRY_CONFLICT' USING ERRCODE='PT409';END IF;
  RETURN receipt.result;
 END IF;
 IF (command->>'version')::bigint IS DISTINCT FROM v THEN RAISE EXCEPTION 'HONOR_CONFLICT' USING ERRCODE='PT409';END IF;
 IF act='restore' THEN
  IF command->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
  SELECT * INTO z FROM oaz_honor_v1.deletions WHERE id=(command->>'trashId')::uuid FOR UPDATE;
  IF z.id IS NULL OR z.restored_at IS NOT NULL OR z.revision IS DISTINCT FROM (command->>'revision')::bigint THEN RAISE EXCEPTION 'HONOR_CONFLICT' USING ERRCODE='PT409';END IF;
  rid:=z.donator_id;
  UPDATE oaz_honor_v1.deletions SET restored_by=a.user_id,restored_at=clock_timestamp(),revision=revision+1 WHERE id=z.id;
  UPDATE oaz_honor_v1.publications SET direct_public=false,revoked_at=CASE WHEN approved_at IS NOT NULL THEN clock_timestamp() END,review_required=false,revision=revision+1,updated_at=clock_timestamp() WHERE donator_id=rid;
  old_status:='deleted';new_status:='revoked';
 ELSE
  IF act<>'create' THEN
   rid:=(command->>'id')::bigint;
   SELECT to_jsonb(d) INTO original FROM public.editor_5_donators d WHERE id=rid FOR UPDATE;
   SELECT * INTO p FROM oaz_honor_v1.publications WHERE donator_id=rid;
   IF a.role<>'SUPER_ADMIN' AND NOT coalesce(p.direct_public OR (p.approved_at<=statement_timestamp() AND p.approved_by IS NOT NULL AND p.consent_reference IS NOT NULL AND p.revoked_at IS NULL AND NOT p.review_required),false) THEN RAISE insufficient_privilege;END IF;
   IF original IS NULL OR (command->>'revision')::bigint IS DISTINCT FROM coalesce(p.revision,0)
    OR EXISTS(SELECT FROM oaz_honor_v1.deletions WHERE donator_id=rid AND restored_at IS NULL) THEN RAISE EXCEPTION 'HONOR_CONFLICT' USING ERRCODE='PT409';END IF;
   old_status:=CASE WHEN p.direct_public THEN 'approved' WHEN p.review_required OR p.approved_at IS NOT NULL AND p.approved_by IS NULL THEN 'pending' WHEN p.revoked_at IS NOT NULL THEN 'revoked' WHEN p.approved_at IS NOT NULL THEN 'approved' ELSE 'draft' END;
  END IF;
  IF act IN ('create','save') THEN
   n:=oaz_honor_v1.clean_name(command->>CASE WHEN act='create' THEN 'name' ELSE 'displayName' END);
   gen:=coalesce(command->>'generation',p.generation,'');aff:=coalesce(command->>'affiliation',p.affiliation,'');intro:=coalesce(command->>'introduction',p.introduction,'');
   IF EXISTS(SELECT FROM jsonb_each(command) e WHERE e.key IN ('name','displayName','generation','affiliation','introduction') AND jsonb_typeof(e.value)<>'string')
    OR length(gen)>20 OR length(aff)>160 OR length(intro)>2000 OR (gen||aff) ~ '[[:cntrl:]<>]' OR intro ~ '[<>]' OR intro ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' THEN RAISE EXCEPTION 'INVALID_TEXT' USING ERRCODE='22023';END IF;
   IF command ? 'position' AND (jsonb_typeof(command->'position')<>'number' OR command->>'position' !~ '^[0-9]{1,6}$') THEN RAISE EXCEPTION 'INVALID_POSITION' USING ERRCODE='22023';END IF;
   pos:=coalesce((command->>'position')::integer,(SELECT position FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND record_id=rid),0);
   IF EXISTS(SELECT FROM public.editor_5_donators d LEFT JOIN oaz_honor_v1.publications h ON h.donator_id=d.id
    WHERE d.id IS DISTINCT FROM rid AND (lower(normalize(regexp_replace(btrim(d.name),'[[:space:]]+',' ','g'),NFC))=lower(n) OR lower(h.display_name)=lower(n)))
    OR EXISTS(SELECT FROM oaz_honor_v1.add_requests WHERE name_key=lower(n) AND status='pending') THEN RAISE EXCEPTION 'HONOR_DUPLICATE' USING ERRCODE='23505';END IF;
   IF act='create' THEN
    INSERT INTO public.editor_5_donators(name) VALUES(n) RETURNING id INTO rid;
    INSERT INTO oaz_honor_v1.publications(donator_id,display_name,generation,affiliation,introduction,revision,direct_public) VALUES(rid,n,gen,aff,intro,1,true);
    old_status:='absent';new_status:='approved';
   ELSE
    changed:=ROW(p.display_name,p.generation,p.affiliation,p.introduction) IS DISTINCT FROM ROW(n,gen,aff,intro);
    INSERT INTO oaz_honor_v1.publications(donator_id,display_name,generation,affiliation,introduction,revision) VALUES(rid,n,gen,aff,intro,1)
    ON CONFLICT(donator_id) DO UPDATE SET display_name=n,generation=gen,affiliation=aff,introduction=intro,revision=oaz_honor_v1.publications.revision+1,
     revoked_at=p.revoked_at,review_required=p.review_required,updated_at=clock_timestamp();
    new_status:=old_status;
   END IF;
   -- Existing orders has a per-board UNIQUE position. Insert at the requested
   -- position and move later honor entries backwards without changing other boards.
   IF pos IS DISTINCT FROM (SELECT position FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND record_id=rid) THEN
    DELETE FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND record_id=rid;
    IF EXISTS(SELECT FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND position=pos) THEN
     IF EXISTS(SELECT FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND position>=999999) THEN RAISE EXCEPTION 'HONOR_ORDER_LIMIT' USING ERRCODE='22023';END IF;
     FOR ordered IN SELECT record_id FROM oaz_admin_v2.orders WHERE table_name='editor_5_donators' AND position>=pos ORDER BY position DESC LOOP
      UPDATE oaz_admin_v2.orders SET position=position+1 WHERE table_name='editor_5_donators' AND record_id=ordered.record_id;
     END LOOP;
    END IF;
    INSERT INTO oaz_admin_v2.orders(table_name,record_id,position) VALUES('editor_5_donators',rid,pos);
   END IF;
  ELSIF act='delete' THEN
   IF command->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
   UPDATE oaz_honor_v1.publications SET direct_public=false,revoked_at=CASE WHEN approved_at IS NOT NULL THEN clock_timestamp() END,revision=revision+1,updated_at=clock_timestamp() WHERE donator_id=rid;
   new_status:='deleted';
   IF act='delete' THEN INSERT INTO oaz_honor_v1.deletions(id,donator_id,original_row,publication_before,deleted_by) VALUES(req,rid,original,coalesce(to_jsonb(p),'{}'),a.user_id);END IF;
  END IF;
 END IF;
 UPDATE oaz_honor_v1.state SET version=version+1 WHERE id RETURNING version INTO v;
 result:=jsonb_build_object('policy','simple-crud-v2','id',rid,'version',v,'status',new_status);
 INSERT INTO oaz_admin_v2.audit(request_id,actor_id,actor_role,actor_slot,action,target_table,record_id,before_status,after_status,assignment_version,changed_fields,result)
 VALUES(req,a.user_id,a.role,a.slot,'honor.'||act,'editor_5_donators',rid,old_status,new_status,av,ARRAY['honor.'||act],'success');
 INSERT INTO oaz_honor_v1.receipts VALUES(req,a.user_id,fp,result);RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.oaz_honor_manage_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;


-- Preserve the old approved projection; no historical row is promoted.
CREATE OR REPLACE FUNCTION public.oaz_public_honor_v1() RETURNS TABLE(display_name text,generation text,affiliation text,introduction text,display_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.display_name,p.generation,p.affiliation,p.introduction,coalesce(o.position,0)::integer
 FROM oaz_honor_v1.publications p LEFT JOIN oaz_admin_v2.orders o ON o.table_name='editor_5_donators' AND o.record_id=p.donator_id
 WHERE (p.direct_public OR (p.approved_at IS NOT NULL AND p.approved_at<=statement_timestamp() AND p.approved_by IS NOT NULL
 AND p.consent_reference IS NOT NULL AND p.revoked_at IS NULL AND NOT p.review_required))
 AND NOT EXISTS(SELECT FROM oaz_honor_v1.deletions z WHERE z.donator_id=p.donator_id AND z.restored_at IS NULL)
 ORDER BY coalesce(o.position,0),p.donator_id LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.oaz_public_honor_v1() FROM PUBLIC,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION oaz_acceptance.honor_workflow(command jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.oaz_honor_manage_v1(command) $$;
REVOKE ALL ON FUNCTION oaz_acceptance.honor_workflow(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION oaz_acceptance.honor_workflow(jsonb) TO authenticated;
UPDATE oaz_final.server_rpc_contract c SET original_oid=f.oid,original_sha256=encode(sha256(convert_to(f.prosrc,'UTF8')),'hex'),owner_oid=f.proowner,original_settings=f.proconfig
FROM pg_proc f WHERE c.signature IN ('oaz_public_honor_v1()','oaz_honor_manage_v1(jsonb)') AND f.oid=to_regprocedure('public.'||c.signature);
NOTIFY pgrst,'reload schema';
COMMIT;
