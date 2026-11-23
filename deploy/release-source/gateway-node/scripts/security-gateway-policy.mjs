import {timingSafeEqual} from 'node:crypto';
const functions=new Set(['oaz_storage_gateway_v1','oaz_account_recovery_v1','oaz_admin_command_v2','oaz_admin_insights_v1','oaz_attachment_access_v1','oaz_attachment_command_v1','oaz_final_command_v1','oaz_honor_manage_v1','oaz_media_approve_scoped_v1','oaz_media_reserve_scoped_v1','oaz_promotion_command_v1','oaz_public_attachments_v1','oaz_public_content_meta_v1','oaz_public_honor_v1','oaz_public_study_sessions_v1']);
export function allowServerRpc(request,expectedKey){
 const name=request.url?.match(/^\/server-rpc\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
 const key=Buffer.from(String(request.headers['x-oaz-server-gate']??'')),expected=Buffer.from(expectedKey??'');
 return request.method==='POST'&&functions.has(name)&&key.length===64&&expected.length===64&&timingSafeEqual(key,expected);
}
export function allowAcceptanceRpc(request,expectedKey){
 const name=request.url?.match(/^\/acceptance-rpc\/v1\/rpc\/([a-z_]+)$/)?.[1];
 const key=Buffer.from(String(request.headers['x-oaz-server-gate']??'')),expected=Buffer.from(expectedKey??'');
 return request.method==='POST'&&['site_manage','site_public','image_access','desktop_image_review_access','image_withdraw','mail_review','honor_workflow','trash_review','accounts_manage','accounts_service','enrollment_self','enrollment_service','login_identity','invitation_manage','invitation_service','invitation_accept','password_identity','password_manage','password_service','super_recovery_service','super_recovery_claim'].includes(name)&&key.length===64&&expected.length===64&&timingSafeEqual(key,expected);
}
