'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { completeRegistration, REGISTRATION_STORAGE_KEY, type RegistrationResult } from '@/lib/registration';

export default function OAuthCallback() {
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const request = useRef<Promise<RegistrationResult> | null>(null);

  useEffect(() => {
    let active = true;
    // Strict Mode의 effect 재실행에서도 같은 작업을 기다린다.
    request.current ??= completeRegistration(
      supabase, () => localStorage.getItem(REGISTRATION_STORAGE_KEY),
    );
    void request.current.then(outcome => {
      if (!active) return;
      if (outcome.status !== 'error') {
        try { localStorage.removeItem(REGISTRATION_STORAGE_KEY); } catch { /* 가입 결과는 유지한다. */ }
      }
      setResult(outcome);
    });
    return () => { active = false; };
  }, []);

  if (!result) return <p className="text-center mt-10" role="status">가입 정보를 확인 중입니다...</p>;
  const message = result.status === 'error' ? result.message
    : result.status === 'existing' ? '이미 등록된 회원입니다. 기존 계정으로 이용할 수 있습니다.'
      : '회원가입이 완료되었습니다!';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white shadow-md rounded-2xl p-9 w-full max-w-md text-center">
        <h1 className={result.status === 'error' ? 'text-red-500 text-xl' : 'text-2xl font-semibold text-gray-800 mb-6'}
          role={result.status === 'error' ? 'alert' : 'status'}>{message}</h1>
        {result.status === 'error' && (
          <Link href="/signin" className="block mt-6 text-gray-700 underline">회원가입 화면으로 돌아가기</Link>
        )}
        <Link href="/" className="inline-block mt-6 bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
