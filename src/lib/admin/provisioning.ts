import { authorizeFresh, type AuthorizationContext } from './authorization'
import { UUID_PATTERN } from './protocol'

export type ProvisioningPort = {
  // Server-only implementation must verify ownership, enqueue an invitation and
  // return pending. It must never activate assignments before acceptance+audit.
  enqueue: (input: { requestId: string; actorId: string; slot: string }) => Promise<{ state: 'pending' }>
}
export async function requestAdminInvitation(context: AuthorizationContext, slot: string,
  enabled: boolean, port: ProvisioningPort | null) {
  if (!enabled || !port || !/^admin[2-5]$/.test(slot) || !UUID_PATTERN.test(context.requestId) ||
    !authorizeFresh(context, 'admins.manage') || !context.identity) throw new Error('INVITATION_NOT_AUTHORIZED')
  return port.enqueue({ requestId: context.requestId, actorId: context.identity.userId, slot })
}
