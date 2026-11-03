'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { hasOAuthCallbackError } from '@/lib/privacy/oauth';

export default function LoginCallback() {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const verifyUser = async () => {
      if (hasOAuthCallbackError(window.location)) {
        await Promise.resolve();
        if (active) setStatus('denied');
        return;
      }
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user || error) {
        setStatus('denied');
        return;
      }

      const uuid = user.id;

      // registered_member 테이블에서 uuid 확인
      const { data: registered, error: memberError } = await supabase
        .from('registered_member')
        .select('uuid')
        .eq('uuid', uuid)
        .maybeSingle();

      if (!active) return;
      if (!memberError && registered) {
        // 로그인 성공 → 대시보드나 메인 페이지로 이동
        setStatus('allowed');
        router.push('/'); // or your main page
      } else {
        // 등록되지 않은 사용자 → 로그아웃
        setStatus('denied');
        await supabase.auth.signOut();
      }
    };

    void verifyUser().catch(() => { if (active) setStatus('denied'); });
    return () => { active = false; };
  }, [router]);

  if (status === 'checking') {
    return <p className="text-center mt-10">🔄 로그인 확인 중...</p>;
  }

  if (status === 'denied') {
    return (
      <div className="text-center mt-10 text-red-500">
        ❌ 등록되지 않은 사용자입니다. 관리자에게 문의하세요.
      </div>
    );
  }

  return null; // redirect 중
}
