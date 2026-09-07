'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginCallback() {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const router = useRouter();

  useEffect(() => {
    const verifyUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!user || error) {
        setStatus('denied');
        return;
      }

      const uuid = user.id;

      // registered_member 테이블에서 uuid 확인
      const { data: registered } = await supabase
        .from('registered_member')
        .select('uuid')
        .eq('uuid', uuid)
        .maybeSingle();

      if (registered) {
        // 로그인 성공 → 대시보드나 메인 페이지로 이동
        setStatus('allowed');
        router.push('/'); // or your main page
      } else {
        // 등록되지 않은 사용자 → 로그아웃
        setStatus('denied');
        await supabase.auth.signOut();
      }
    };

    verifyUser();
  }, []);

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
