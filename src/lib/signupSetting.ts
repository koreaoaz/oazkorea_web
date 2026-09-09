import { supabase } from "@/lib/supabaseClient"

export const SIGNUP_SETTING_TABLE = "signup_setting"
const SIGNUP_SETTING_ID = 1

export type SignupSetting = {
  id: number
  deadline: string | null
  password: string | null
}

export async function fetchSignupSetting(): Promise<SignupSetting | null> {
  const { data, error } = await supabase
    .from(SIGNUP_SETTING_TABLE)
    .select("id, deadline, password")
    .eq("id", SIGNUP_SETTING_ID)
    .maybeSingle()

  if (error) {
    console.error("회원가입 설정 조회 실패:", error.message)
    return null
  }

  return data
}

export async function saveSignupSetting(deadline: string, password: string) {
  const { error } = await supabase.from(SIGNUP_SETTING_TABLE).upsert({
    id: SIGNUP_SETTING_ID,
    deadline,
    password,
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}

export function isSignupOpen(setting: SignupSetting | null, now: number = Date.now()) {
  if (!setting?.deadline) return false
  return new Date(setting.deadline).getTime() > now
}
