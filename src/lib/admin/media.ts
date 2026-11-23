/** Pure lifecycle contract; never deletes uploaded/unconfirmed files automatically. */
export type MediaReceipt = Readonly<{
  bucket: string; path: string; origin: 'existing' | 'new';
  state: 'uploaded' | 'unconfirmed' | 'referenced' | 'review_required'
}>
const buckets = new Set(['project_img','study-images','card_news','notice-images'])
export function settleMedia(receipts: readonly MediaReceipt[], outcome: 'committed'|'failed'|'unknown'): readonly MediaReceipt[] {
  return receipts.map(receipt => ({ ...receipt,
    state: receipt.origin === 'existing' ? receipt.state :
      outcome === 'committed' && receipt.state === 'uploaded' ? 'referenced' : 'review_required' }))
}
export function mayDeleteMedia(receipt: MediaReceipt, evidence: Readonly<{
  activeAdmin: boolean; authoritativeReferences: number | null; retentionExpired: boolean;
  explicitApproval: boolean; inventoryVersion: number; currentVersion: number
}>) {
  return buckets.has(receipt.bucket) && receipt.origin === 'new' && receipt.state === 'review_required' &&
    evidence.activeAdmin && evidence.authoritativeReferences === 0 && evidence.retentionExpired && evidence.explicitApproval &&
    Number.isSafeInteger(evidence.inventoryVersion) && evidence.inventoryVersion >= 0 && evidence.inventoryVersion === evidence.currentVersion
}
