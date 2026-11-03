export const PRIVACY_CAPABILITIES = ['members.read', 'approvals.read', 'donors.private.read', 'administrators.directory.read', 'approvals.write'] as const
export const PRIVATE_EDITOR_TABLES = ['registered_member', 'allowed_user', 'supervisor_id', 'editor_5_donators', 'who_is_boss'] as const
export function privateEditorTable(table: string) { return PRIVATE_EDITOR_TABLES.some(value => value === table) }
export function privateReadOnly(table: string) { return privateEditorTable(table) && table !== 'editor_5_donators' }
