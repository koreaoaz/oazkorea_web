/** Future server/DB adapter decision model. This module grants no live access.
 * Identity and assignments must come from verified server auth and current DB state.
 * UI flags, email, user_metadata and registered_member.is_manager are not inputs.
 */
export type AdminSlot = `admin${number}`
export type AdminRole = 'super_admin' | 'content_admin'
export type Assignment = Readonly<{
  slot: AdminSlot; userId: string; role: AdminRole; status: 'active' | 'disabled'; revision: number
}>
export const CONTENT_TABLES = [
  'editor_0_noti', 'editor_1_projects', 'editor_2_studies',
  'editor_3_study_timetable', 'editor_4_schedules', 'editor_6_events',
] as const
export type AdminAction = 'content.write' | 'admins.manage' | 'audit.read' | 'members.read'
export type AdminIdentity = Readonly<{ userId: string; aal: 'aal1' | 'aal2' }>
type Identity = AdminIdentity
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validAssignments(rows: readonly Assignment[]): boolean {
  if (!Array.isArray(rows)) return false
  const slots = new Set<string>(), users = new Set<string>()
  return rows.every(row => {
    if (!row || typeof row.userId !== 'string' || !/^admin[1-9][0-9]{0,6}$/.test(row.slot) || !uuid.test(row.userId) ||
      !['active', 'disabled'].includes(row.status) ||
      !Number.isSafeInteger(row.revision) || row.revision < 0 ||
      row.role !== (row.slot === 'admin1' ? 'super_admin' : 'content_admin') ||
      slots.has(row.slot) || users.has(row.userId.toLowerCase())) return false
    slots.add(row.slot); users.add(row.userId.toLowerCase()); return true
  })
}

export function canAdmin(
  identity: Identity | null, rows: readonly Assignment[], action: AdminAction, table?: string,
): boolean {
  if (!identity || !uuid.test(identity.userId) || !['aal1', 'aal2'].includes(identity.aal) || !validAssignments(rows)) return false
  const actor = rows.find(row => row.userId.toLowerCase() === identity.userId.toLowerCase() && row.status === 'active')
  if (!actor) return false
  if (action === 'content.write') return CONTENT_TABLES.some(value => value === table)
  if (action === 'admins.manage' || action === 'audit.read') return actor.role === 'super_admin' && identity.aal === 'aal2'
  return false // PII access scope is undecided, including for super_admin.
}

/** A proposal only. DB must enforce revision, identity, last-super-admin and audit atomically. */
export function canProposeAssignmentChange(
  identity: Identity | null, current: readonly Assignment[], proposed: readonly Assignment[], expectedRevisions: Readonly<Record<string, number>>,
): boolean {
  if (!canAdmin(identity, current, 'admins.manage') || !validAssignments(proposed)) return false
  const superAdmin = current.find(row => row.slot === 'admin1')
  const nextSuper = proposed.find(row => row.slot === 'admin1')
  if (!superAdmin || !nextSuper || nextSuper.status !== 'active' ||
    nextSuper.userId !== superAdmin.userId || nextSuper.revision !== superAdmin.revision) return false
  for (const previous of current) {
    const next = proposed.find(row => row.slot === previous.slot)
    if (!next || expectedRevisions[previous.slot] !== previous.revision) return false
    const changed = next.userId !== previous.userId || next.status !== previous.status
    if (next.revision !== previous.revision + (changed ? 1 : 0)) return false
  }
  return proposed.every(row => current.some(old => old.slot === row.slot) || (row.slot !== 'admin1' && row.revision === 0))
}
