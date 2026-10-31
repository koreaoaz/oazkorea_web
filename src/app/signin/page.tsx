'use client';

import { useState, type FormEvent } from 'react';
import { Github } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { parseRegistrationProfile, REGISTRATION_STORAGE_KEY, type RegistrationProfile } from '@/lib/registration';

const fields: { name: keyof RegistrationProfile; label: string; placeholder: string }[] = [
  { name: 'name', label: '이름', placeholder: '이름' },
  { name: 'department', label: '소속 학과', placeholder: '소속 학과' },
  { name: 'studentId', label: '학번', placeholder: '학번' },
  { name: 'phone_number', label: '연락처', placeholder: '010-xxxx-xxxx' },
  { name: 'generation', label: '기수', placeholder: '기수' },
];

export default function RegistrationForm() {
  const [form, setForm] = useState<RegistrationProfile>({
    name: '', department: '', studentId: '', generation: '', phone_number: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isFormFilled = Object.values(form).every(value => value.trim() !== '');

  const handleGithubLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const profile = parseRegistrationProfile(JSON.stringify(form));
    if (!profile) {
      setErrorMessage('가입 정보를 모두 올바르게 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      // 프로필만 임시 보관한다. 승인·이메일·UUID·관리자 권한 정보는 저장하지 않는다.
      localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(profile));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/oauth_callback` },
      });
      if (error) {
        setErrorMessage('GitHub 인증을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setSubmitting(false);
      }
    } catch {
      setErrorMessage('브라우저 저장소 또는 연결을 확인한 뒤 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form onSubmit={handleGithubLogin} className="p-6 rounded-lg w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-center">회원가입</h1>
        <p className="text-sm text-gray-600">
          신규 가입은 GitHub 인증으로 확인된 이메일을 기준으로 승인 여부를 확인합니다.
          승인받은 이메일과 다르면 관리자에게 문의해 주세요. 기존 회원 로그인은 그대로 이용할 수 있습니다.
        </p>
        {fields.map(field => (
          <label key={field.name} className="block text-sm text-gray-700">
            {field.label}
            <input name={field.name} type="text" placeholder={field.placeholder}
              value={form[field.name]} onChange={event => {
                const value = event.target.value;
                setForm(previous => ({ ...previous, [field.name]: value }));
              }}
              maxLength={500} className="mt-1 w-full p-2 border rounded-md" required disabled={submitting} />
          </label>
        ))}
        {errorMessage && <p className="text-sm text-red-500" role="alert">{errorMessage}</p>}
        <button type="submit" disabled={!isFormFilled || submitting}
          className={`w-full flex justify-center items-center py-2 rounded-md space-x-2 ${
            isFormFilled && !submitting ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}>
          <Github className="w-5 h-5" />
          <span>{submitting ? 'GitHub 인증으로 이동 중...' : 'GitHub로 회원가입'}</span>
        </button>
      </form>
    </div>
  );
}
