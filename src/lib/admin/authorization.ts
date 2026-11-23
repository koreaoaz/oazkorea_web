import { canAdmin, canProposeAssignmentChange, type AdminAction, type AdminIdentity, type Assignment, type AdminRole, type AdminSlot } from './policy'

/** Pure proposal contracts. The future server must obtain both versions from current
 * authoritative DB reads, bind them to this request, and recheck inside the mutation transaction.
 * Neither timestamps nor caller-supplied booleans constitute authentication.
 */
export type AuthorizationContext = Readonly<{
  identity: AdminIdentity | null
  requestId: string
  authoritativeVersion: number
  nowMs: number
  snapshot: Readonly<{ rows: readonly Assignment[]; version: number; fetchedAtMs: number; requestId: string }>
}>
export const MAX_SNAPSHOT_AGE_MS = 5000
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0
export type ContentChange = 'title' | 'body' | 'media' | 'schedule'
const changes: readonly string[] = ['title', 'body', 'media', 'schedule']
export type AuditDraft = Readonly<{
  schemaVersion: 1; requestId: string; actorUserId: string; actorRole: AdminRole
  action: 'content.update' | 'admin.assignment.change'
  target: Readonly<{ kind: 'content'; table: string; id: number }> |
          Readonly<{ kind: 'assignment'; slot: AdminSlot; beforeUserId: string | null; afterUserId: string }>
  changedFields: readonly string[]
  beforeRevision: number | null; afterRevision: number
  assignmentVersion: number; proposedAtMs: number
  requiresAtomicAudit: true; committed: false
}>

export function freshAuthorization(context: AuthorizationContext): boolean {
  if (!context || typeof context.requestId !== 'string' || !context.snapshot) return false
  const { snapshot } = context
  return uuid.test(context.requestId) && context.requestId === snapshot.requestId &&
    nonnegative(context.authoritativeVersion) && nonnegative(snapshot.version) &&
    snapshot.version === context.authoritativeVersion &&
    nonnegative(context.nowMs) && nonnegative(snapshot.fetchedAtMs) &&
    snapshot.fetchedAtMs <= context.nowMs && context.nowMs - snapshot.fetchedAtMs <= MAX_SNAPSHOT_AGE_MS
}

export function authorizeFresh(context: AuthorizationContext, action: AdminAction, table?: string): boolean {
  return freshAuthorization(context) && canAdmin(context.identity, context.snapshot.rows, action, table)
}

function actor(context: AuthorizationContext) {
  return context.snapshot.rows.find(row => row.userId.toLowerCase() === context.identity?.userId.toLowerCase())
}

export function draftContentAudit(context: AuthorizationContext, change: Readonly<{
  table: string; id: number; fields: readonly ContentChange[]; expectedRevision: number; actualRevision: number
}>): AuditDraft | null {
  if (!authorizeFresh(context, 'content.write', change.table) ||
    !Number.isSafeInteger(change.id) || change.id <= 0 ||
    !nonnegative(change.expectedRevision) || change.expectedRevision >= Number.MAX_SAFE_INTEGER ||
    change.expectedRevision !== change.actualRevision || !Array.isArray(change.fields) ||
    change.fields.length === 0 || change.fields.length > changes.length ||
    new Set(change.fields).size !== change.fields.length || !change.fields.every(field => changes.includes(field))) return null
  const currentActor = actor(context)
  if (!currentActor) return null
  return { schemaVersion: 1, requestId: context.requestId, actorUserId: currentActor.userId, actorRole: currentActor.role,
    action: 'content.update', target: { kind: 'content', table: change.table, id: change.id },
    changedFields: [...change.fields], beforeRevision: change.expectedRevision, afterRevision: change.expectedRevision + 1,
    assignmentVersion: context.snapshot.version, proposedAtMs: context.nowMs, requiresAtomicAudit: true, committed: false }
}

export function draftAssignmentAudit(context: AuthorizationContext, proposed: readonly Assignment[],
  expectedRevisions: Readonly<Record<string, number>>): AuditDraft | null {
  if (!authorizeFresh(context, 'admins.manage') ||
    !canProposeAssignmentChange(context.identity, context.snapshot.rows, proposed, expectedRevisions)) return null
  const changed = proposed.filter(row => {
    const previous = context.snapshot.rows.find(old => old.slot === row.slot)
    return !previous || previous.userId !== row.userId || previous.status !== row.status
  })
  if (changed.length !== 1) return null // One auditable target and idempotency request per transaction.
  const next = changed[0], previous = context.snapshot.rows.find(row => row.slot === next.slot)
  const currentActor = actor(context)
  if (!currentActor) return null
  return { schemaVersion: 1, requestId: context.requestId, actorUserId: currentActor.userId, actorRole: currentActor.role,
    action: 'admin.assignment.change', target: { kind: 'assignment', slot: next.slot, beforeUserId: previous?.userId ?? null, afterUserId: next.userId },
    changedFields: [!previous || previous.userId !== next.userId ? 'assignment.identity' : 'assignment.status'],
    beforeRevision: previous?.revision ?? null, afterRevision: next.revision,
    assignmentVersion: context.snapshot.version, proposedAtMs: context.nowMs, requiresAtomicAudit: true, committed: false }
}
