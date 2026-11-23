import { validAssignments, type Assignment } from '../admin/policy'

export const PRIVACY_CAPABILITIES = ['members.read', 'approvals.read', 'donors.private.read', 'administrators.directory.read', 'approvals.write'] as const
export type PrivacyCapability = typeof PRIVACY_CAPABILITIES[number]
export type PrivacyGrant = Readonly<{
  userId: string; capability: PrivacyCapability; authority: 'LEGACY' | 'ADMIN_V2'; assignmentRevision: number | null
}>

/** Pure mirror only. Production enforcement uses current DB rows on every RPC.
 * A super_admin/content role alone never grants PII. Never trust client snapshots.
 */
export function canReadPrivacy(
  userId: string | null, activeAuth: boolean, capability: PrivacyCapability,
  grants: readonly PrivacyGrant[], assignments: readonly Assignment[],
  adminModelInstalled: boolean, activeLegacyEditor = false,
): boolean {
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    activeAuth !== true || !validAssignments(assignments) || !PRIVACY_CAPABILITIES.includes(capability) ||
    !Array.isArray(grants) || grants.some(g => !g || typeof g.userId !== 'string' || !PRIVACY_CAPABILITIES.includes(g.capability))) return false
  const matching = grants.filter(g => g.userId.toLowerCase() === userId.toLowerCase() && g.capability === capability)
  if (matching.length !== 1) return false
  const grant = matching[0]
  if (!adminModelInstalled) return grant.authority === 'LEGACY' && grant.assignmentRevision === null && activeLegacyEditor
  const actor = assignments.find(a => a.userId.toLowerCase() === userId.toLowerCase() && a.status === 'active')
  return !!actor && grant.authority === 'ADMIN_V2' && Number.isSafeInteger(grant.assignmentRevision) &&
    grant.assignmentRevision === actor.revision
}

export const PRIVATE_EDITOR_TABLES = ['registered_member', 'allowed_user', 'supervisor_id', 'editor_5_donators'] as const
export function privateEditorTable(table: string) { return PRIVATE_EDITOR_TABLES.some(t => t === table) || table === 'who_is_boss' }
export function privateReadOnly(table: string) { return privateEditorTable(table) && table !== 'editor_5_donators' }
