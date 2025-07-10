'use client';

import React, { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RegistrationForm() {
  const [form, setForm] = useState({
    name: '',
    department: '',
    studentId: '',
    generation: '',
    email: ''
  });

  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);

    // 이메일 입력 시 허용 여부 확인
    if (name === 'email') {
      const { data, error } = await supabase
        .from('allowed_user')
        .select('email')
        .eq('email', value)
        .single();

      setIsAllowed(!!data && !error);
    }
  };

  const handleGithubLogin = async () => {
    localStorage.setItem('registration_data', JSON.stringify(form));

    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3000/oauth_callback',
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

        <input
          name="email"
          type="text"
          placeholder="이메일"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        {isAllowed === false && (
          <p className="text-sm text-red-500">❌ 허용되지 않은 이메일입니다.</p>
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
          name="generation"
          type="text"
          placeholder="기수 ex) 34"
          value={form.generation}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />

        <button
          type="button"
          onClick={handleGithubLogin}
          disabled={!isAllowed}
          className={`w-full flex justify-center items-center py-2 rounded-md space-x-2 ${
            isAllowed
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Github className="w-5 h-5" />
          <span>Sign in with GitHub</span>
        </button>
      </form>
    </div>
  );
}
