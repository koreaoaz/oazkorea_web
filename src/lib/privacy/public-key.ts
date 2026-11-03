/** A public browser bundle must never receive an elevated Supabase credential. */
export function assertPublicCredential(key: string): void {
  if (key.startsWith('sb_secret_')) throw new Error('공개 클라이언트 키 설정을 확인해 주세요.');
  if (key.startsWith('eyJ')) {
    let role: unknown;
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      role = JSON.parse(atob(payload)).role;
    } catch { throw new Error('공개 클라이언트 키 설정을 확인해 주세요.'); }
    if (role !== 'anon') throw new Error('공개 클라이언트 키 설정을 확인해 주세요.');
  }
}
