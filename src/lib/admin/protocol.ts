import { CONTENT_TABLES } from './policy'

export const ADMIN_SCHEMA_VERSION = 2
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type AdminCommand = Readonly<{
  action: 'session' | 'admins.list' | 'admins.assign' | 'audit.list' | 'content.list' |
    'content.create' | 'content.update' | 'content.delete' | 'content.pin' | 'order.list' | 'order.save' |
    'accounts.upsert' | 'accounts.prepare' | 'accounts.complete'
  requestId: string
  version: number
  table?: string
  id?: number
  revision?: number
  payload?: Readonly<Record<string, unknown>>
  slot?: string
  userId?: string
  status?: 'active' | 'disabled'
  ids?: readonly number[]
  displayName?: string
  scopes?: readonly string[]
  operationId?: string
  changeCategory?: 'unclassified'|'bugfix'|'improvement'|'content'|'other'
  changeReason?: string
  kind?: 'notice'|'promotion'|'all'
  pinned?: boolean
}>
const actions = new Set(['session', 'admins.list', 'admins.assign', 'audit.list', 'content.list',
  'content.create', 'content.update', 'content.delete', 'content.pin', 'order.list', 'order.save', 'accounts.upsert','accounts.prepare','accounts.complete'])
const keys = new Set(['action', 'requestId', 'version', 'table', 'id', 'revision', 'payload', 'slot', 'userId', 'status', 'ids','displayName','scopes','operationId','changeCategory','changeReason','pinned','kind'])
const safeInteger = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
export function parseAdminCommand(value: unknown): AdminCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if(('changeCategory' in v||'changeReason' in v)&&(!['content.create','content.update','content.delete','content.pin','order.save'].includes(String(v.action))||('changeCategory' in v&&(typeof v.changeCategory!=='string'||!['unclassified','bugfix','improvement','content','other'].includes(v.changeCategory)))||('changeReason' in v&&(typeof v.changeReason!=='string'||v.changeReason.length>160))))return null
  if (Object.keys(v).some(k => !keys.has(k)) || typeof v.action !== 'string' || !actions.has(v.action) ||
    typeof v.requestId !== 'string' || !UUID_PATTERN.test(v.requestId) || !safeInteger(v.version)) return null
  if (v.action.startsWith('content.') || v.action.startsWith('order.')) {
    if (!CONTENT_TABLES.some(t => t === v.table)) return null
  }
  if (['content.update', 'content.delete', 'content.pin'].includes(v.action) && (!safeInteger(v.id) || !safeInteger(v.revision))) return null
  if (['content.create', 'content.update'].includes(v.action)) {
    if (!v.payload || typeof v.payload !== 'object' || Array.isArray(v.payload) || Object.keys(v.payload).length === 0 ||
      Object.keys(v.payload).some(k => ['id', 'created_at','updated_at', 'pinned','pinned_at','__proto__', 'prototype', 'constructor'].includes(k))) return null
  }
  if (v.action === 'admins.assign' && (!/^admin[2-5]$/.test(String(v.slot)) || typeof v.userId !== 'string' ||
    !UUID_PATTERN.test(v.userId) || !['active', 'disabled'].includes(String(v.status)) || !safeInteger(v.revision))) return null
  if (v.action.startsWith('accounts.')) {
    if (typeof v.slot!=='string' || !/^admin[1-9][0-9]{0,6}$/.test(v.slot) || v.slot==='admin1') return null
    if (v.action!=='accounts.prepare' && (typeof v.userId!=='string' || !UUID_PATTERN.test(v.userId) ||
      typeof v.displayName!=='string' || v.displayName.length>80 || !safeInteger(v.revision) ||
      !['active','disabled'].includes(String(v.status)) || !Array.isArray(v.scopes) ||
      v.scopes.length>CONTENT_TABLES.length || new Set(v.scopes).size!==v.scopes.length ||
      v.scopes.some(t=>!CONTENT_TABLES.some(allowed=>allowed===t)))) return null
    if(v.action==='accounts.complete' && (typeof v.operationId!=='string'||!UUID_PATTERN.test(v.operationId))) return null
  }
  if (v.action === 'order.save' && (!safeInteger(v.revision) || !Array.isArray(v.ids) || v.ids.length > 1000 ||
    v.ids.some(id => !safeInteger(id)) || new Set(v.ids).size !== v.ids.length)) return null
  if('kind' in v&&(v.action!=='content.list'||v.table!=='editor_0_noti'||!['notice','promotion','all'].includes(String(v.kind))))return null
  if ('pinned' in v && v.action!=='content.pin') return null
  if(v.action==='content.pin'&&(v.table!=='editor_0_noti'||typeof v.pinned!=='boolean'||Object.keys(v).some(k=>!['action','requestId','version','table','id','revision','pinned','changeCategory','changeReason'].includes(k))))return null
  return v as AdminCommand
}

/** Only fixed local destinations; never return user-controlled URLs. */
export function adminDestination() { return '/admin' }
export function adminEditorEnabled() {
  try{return process.env.NEXT_PUBLIC_OAZ_ADMIN_EDITOR_V2==='true'||process.env.NEXT_PUBLIC_OAZ_MAIN_RELEASE==='reviewed-v1'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://maoefmwpdcnugyenyiea.supabase.co'}catch{return false}
}

export function adminConfiguration(env: Readonly<Record<string, string | undefined>>) {
  if (env.OAZ_ADMIN_ENABLED !== 'true' || env.OAZ_ADMIN_SCHEMA_VERSION !== String(ADMIN_SCHEMA_VERSION)) return null
  try {
    const url = new URL(env.OAZ_ADMIN_ORIGIN ?? '')
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.origin !== env.OAZ_ADMIN_ORIGIN || url.username || url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null
    return { origin: url.origin }
  } catch { return null }
}
