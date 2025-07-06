'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ProjectsPage() {
  const [session, setSession] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await fetchProjects();
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('Projects')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setProjects(data);
    }
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: process.env.NEXT_PUBLIC_ORIGIN_URL,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title || !body) {
      setMessage('제목과 내용을 모두 입력하세요.');
      return;
    }

    const { error } = await supabase.from('Projects').insert({
      user_id: session.user.id,
      title,
      body,
    });

    if (error) {
      setMessage(`❌ 등록 실패: ${error.message}`);
    } else {
      setMessage('✅ 게시글이 등록되었습니다!');
      setTitle('');
      setBody('');
      fetchProjects();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">📝 프로젝트 게시판</h1>

      {/* 게시글 리스트는 로그인 여부 관계없이 항상 표시 */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4">📚 최근 프로젝트</h2>
        {projects.length > 0 ? (
          <ul className="space-y-4">
            {projects.map((proj) => (
              <li key={proj.id} className="border p-4 rounded shadow">
                <h3 className="text-lg font-bold">{proj.title}</h3>
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">{proj.body}</p>
                <p className="text-sm text-gray-400 mt-1">
                  작성일: {new Date(proj.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>등록된 프로젝트가 없습니다.</p>
        )}
      </div>

      {/* 로그인한 사람만 글 작성 가능 */}
      {session ? (
        <div className="space-y-6">
          <p className="text-green-600">🔐 로그인됨: {session.user.email}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-semibold">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold">내용</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={5}
                placeholder="내용을 입력하세요"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              게시글 등록
            </button>
          </form>

          {message && <p className="mt-2 text-sm">{message}</p>}

          <button
            onClick={handleLogout}
            className="mt-4 text-sm text-red-500 underline"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-700">✏️ 게시글을 작성하려면 로그인하세요.</p>
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            GitHub로 로그인
          </button>
        </div>
      )}
    </div>
  );
}
