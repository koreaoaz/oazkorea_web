'use client';

import React, { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { SignupSetting, fetchSignupSetting } from '@/lib/signupSetting';

const formatRemaining = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days}일 ${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

export default function RegistrationForm() {
  const [form, setForm] = useState({
    name: '',
    department: '',
    studentId: '',
    generation: '',
    email: '',
    phone_number: ''
  });

  const [password, setPassword] = useState('');
  const [setting, setSetting] = useState<SignupSetting | null>(null);
  const [settingLoading, setSettingLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [isRegistered, setIsRegistered] = useState<'registered' | 'unregistered' | null>(null);
  const isFormFilled =
      form.name.trim() !== '' &&
      form.department.trim() !== '' &&
      form.studentId.trim() !== '' &&
      form.generation.trim() !== '' &&
      form.email.trim() !== '' &&
      form.phone_number.trim() !== '';

  useEffect(() => {
    fetchSignupSetting().then((data) => {
      setSetting(data);
      setSettingLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = setting?.deadline ? new Date(setting.deadline).getTime() - now : null;
  const isOpen = remaining !== null && remaining > 0;
  const isPasswordCorrect = !!setting?.password && password === setting.password;
  const canSubmit = isOpen && isPasswordCorrect && isFormFilled && isRegistered !== 'registered';

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);

    if (name === 'email') {
      // check if email is already registered
      const { data: registered } = await supabase
        .from('registered_member')
        .select('email')
        .eq('email', value)
        .maybeSingle();

      setIsRegistered(registered ? 'registered' : 'unregistered');
    }
  };

  const handleGithubLogin = async () => {
    localStorage.setItem('registration_data', JSON.stringify(form));

    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://www.oazkorea.co.kr/oauth_callback',
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="p-6 rounded-lg w-full max-w-md space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Register</h1>

        {!settingLoading && (
          <div className="rounded-md border p-4 text-center">
            <p className="text-sm text-gray-500">회원가입 마감까지</p>
            <p className={`text-xl font-bold tabular-nums ${isOpen ? 'text-blue-600' : 'text-red-500'}`}>
              {remaining === null ? '미설정' : isOpen ? formatRemaining(remaining) : '마감'}
            </p>
          </div>
        )}

        <input
          name="email"
          type="text"
          placeholder="이메일"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <input
          name="password"
          type="password"
          placeholder="회원가입 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded-md"
          required
        />

        {!settingLoading && !isOpen && (
          <p className="text-sm text-red-500">❌ 현재는 회원가입 기간이 아닙니다.</p>
        )}
        {isOpen && password !== '' && !isPasswordCorrect && (
          <p className="text-sm text-red-500">❌ 비밀번호가 일치하지 않습니다.</p>
        )}
        {isOpen && isPasswordCorrect && isRegistered !== 'registered' && (
          <p className="text-sm text-red-500">⭕ 나머지 정보를 기입 부탁드립니다.</p>
        )}
        {isRegistered === 'registered' && (
          <p className="text-sm text-red-500">❌ 이미 가입된 이메일입니다.</p>
        )}

        <input
          name="name"
          type="text"
          placeholder="이름"
          value={form.name}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <input
          name="department"
          type="text"
          placeholder="소속 학과"
          value={form.department}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <input
          name="studentId"
          type="text"
          placeholder="학번 ex) 2022048098"
          value={form.studentId}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <input
          name="phone_number"
          type="text"
          placeholder="연락처 ex) 010-xxxx-xxxx"
          value={form.phone_number}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <input
          name="generation"
          type="text"
          placeholder="기수 ex) 34, (2025년은 36기 입니다.)"
          value={form.generation}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <button
          type="button"
          onClick={handleGithubLogin}
          disabled={!canSubmit}
          className={`w-full flex justify-center items-center py-2 rounded-md space-x-2 ${
            canSubmit
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Github className="w-5 h-5" />
          <span>Sign up with GitHub</span>
        </button>
      </form>
    </div>
  );
}
