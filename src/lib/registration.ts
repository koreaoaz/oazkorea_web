import type { SupabaseClient } from '@supabase/supabase-js';

export const REGISTRATION_STORAGE_KEY = 'registration_data';
export type RegistrationProfile = {
  name: string;
  department: string;
  studentId: string;
  generation: string;
  phone_number: string;
};
export type RegistrationResult =
  | { status: 'registered' | 'existing' }
  | { status: 'error'; message: string };
type RegistrationClient = Pick<SupabaseClient, 'auth' | 'from'>;

export function parseRegistrationProfile(raw: string | null): RegistrationProfile | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const fields = ['name', 'department', 'studentId', 'generation', 'phone_number'] as const;
    const profile = {} as RegistrationProfile;
    for (const field of fields) {
      const entry = record[field];
      if (typeof entry !== 'string' || !entry.trim() || entry.length > 500) return null;
      profile[field] = entry.trim();
    }
    return profile;
  } catch { return null; }
}

export async function completeRegistration(
  client: RegistrationClient,
  readProfile: () => string | null,
): Promise<RegistrationResult> {
  try {
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return { status: 'error', message: '로그인을 확인할 수 없습니다. 회원가입 화면에서 GitHub 인증을 다시 진행해 주세요.' };
    }
    const findExisting = () => client.from('registered_member')
      .select('uuid').eq('uuid', user.id).maybeSingle();
    const existing = await findExisting();
    if (existing.error) {
      return { status: 'error', message: '기존 회원 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    // 기존 회원은 등록 이메일과 Auth 이메일이 달라도 UUID 기준으로 유지한다.
    if (existing.data) return { status: 'existing' };
    const email = user.email?.trim();
    if (!email || !user.email_confirmed_at) {
      return { status: 'error', message: '인증된 이메일을 확인할 수 없습니다. GitHub 이메일 인증 상태를 확인한 뒤 다시 시도해 주세요.' };
    }
    if (!user.identities?.some(identity => identity.provider === 'github')) {
      return { status: 'error', message: 'GitHub 인증 정보를 확인할 수 없습니다. GitHub로 다시 로그인해 주세요.' };
    }
    const profile = parseRegistrationProfile(readProfile());
    if (!profile) {
      return { status: 'error', message: '가입 정보가 없거나 올바르지 않습니다. 회원가입 화면에서 정보를 다시 입력해 주세요.' };
    }
    // 최종 이메일 소유·승인 검증은 함께 제공되는 DB RLS에서 강제한다.
    const { error } = await client.from('registered_member').insert({
      name: profile.name, department: profile.department,
      student_id: profile.studentId, generation: profile.generation,
      phone_number: profile.phone_number,
      email, uuid: user.id, is_manager: false,
    });
    if (!error) return { status: 'registered' };
    if (error.code === '23505') {
      const duplicate = await findExisting();
      if (!duplicate.error && duplicate.data) return { status: 'existing' };
      return { status: 'error', message: '이미 사용 중인 가입 정보입니다. 관리자에게 문의해 주세요.' };
    }
    if (error.code === '42501') {
      return { status: 'error', message: '가입 승인을 확인하지 못했습니다. GitHub 인증 이메일의 승인 등록 여부를 관리자에게 확인해 주세요.' };
    }
    return { status: 'error', message: '회원가입을 완료하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.' };
  } catch {
    return { status: 'error', message: '가입 처리 중 연결 또는 저장소 오류가 발생했습니다. 회원가입 화면에서 다시 시도해 주세요.' };
  }
}
