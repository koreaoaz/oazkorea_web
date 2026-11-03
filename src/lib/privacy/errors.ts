export class PrivacyAccessError extends Error {
  constructor(message: string) { super(message); this.name = 'PrivacyAccessError' }
}
export function privacyFailure(error: unknown): string {
  return error instanceof PrivacyAccessError ? error.message : '개인정보 기능을 확인하지 못했습니다. 권한 승인 또는 보호 기능 준비 상태를 확인해 주세요.'
}
