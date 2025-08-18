'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BoardType = '공지' | 'proj_list';

export default function AdminBoardPage() {
  const [session, setSession] = useState<any>(null);
  const [board, setBoard] = useState<BoardType>('공지');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      fetchPosts(board);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPosts = async (board: BoardType) => {
    const table = board === '공지' ? 'Notice' : 'Projects';
    const { data, error } = await supabase
      .from(table)
      .select('id, title, body, image_url, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setPosts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title || !body) {
      setMessage('제목과 내용을 모두 입력하세요.');
      return;
    }

    // 이미지 업로드
    let imageUrl: string | null = null;
    if (image) {
      const { data, error } = await supabase.storage
        .from('board-images') // 미리 만든 버킷
        .upload(`${Date.now()}_${image.name}`, image);

      if (error) {
        setMessage(`❌ 이미지 업로드 실패: ${error.message}`);
        return;
      }
      imageUrl = data.path;
    }

    const table = board === '공지' ? 'Notice' : 'Projects';

    const { error } = await supabase.from(table).insert({
      user_id: session.user.id,
      title,
      body,
      image_url: imageUrl,
    });

    if (error) {
      setMessage(`❌ 등록 실패: ${error.message}`);
    } else {
      setMessage('✅ 게시글이 등록되었습니다!');
      setTitle('');
      setBody('');
      setImage(null);
      fetchPosts(board);
    }
  };

  const handleDelete = async (id: number) => {
    const table = board === '공지' ? 'Notice' : 'Projects';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      setMessage(`❌ 삭제 실패: ${error.message}`);
    } else {
      setMessage('🗑️ 삭제 완료');
      fetchPosts(board);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">📋 관리자 게시판</h1>

      {/* 게시판 선택 */}
      <select
        value={board}
        onChange={(e) => {
          setBoard(e.target.value as BoardType);
          fetchPosts(e.target.value as BoardType);
        }}
        className="border rounded px-3 py-2 mb-6"
      >
        <option value="공지">공지</option>
        <option value="proj_list">프로젝트</option>
      </select>

      {/* 게시글 리스트 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold">{board} 리스트</h2>
        {posts.length > 0 ? (
          <ul className="space-y-4 mt-4">
            {posts.map((p) => (
              <li key={p.id} className="border p-4 rounded shadow">
                {p.image_url && (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/board-images/${p.image_url}`}
                    alt="thumbnail"
                    className="w-40 mb-2"
                  />
                )}
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{p.body}</p>
                <p className="text-sm text-gray-400">
                  {new Date(p.created_at).toLocaleString()}
                </p>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="mt-2 px-3 py-1 bg-red-500 text-white text-sm rounded"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4">게시글이 없습니다.</p>
        )}
      </div>

      {/* 글 작성 폼 */}
      {session ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-semibold">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="제목 입력"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">내용</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
              placeholder="내용 입력"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">이미지 첨부</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </div>

          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            {board} 등록
          </button>

          {message && <p className="mt-2 text-sm">{message}</p>}
        </form>
      ) : (
        <p className="text-gray-600">🔒 로그인 후 게시글 작성 가능</p>
      )}
    </div>
  );
}
