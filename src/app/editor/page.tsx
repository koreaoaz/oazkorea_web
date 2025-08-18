'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BoardType = '공지' | '프로젝트' | '스터디';

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

  const getTableName = (board: BoardType) => {
    if (board === '공지') return 'editor_0_noti';
    if (board === '프로젝트') return 'editor_1_projects';
    if (board === '스터디') return 'editor_2_studies';
    return '';
  };

  const fetchPosts = async (board: BoardType) => {
    const table = getTableName(board);
    if (!table) return;

    const { data, error } = await supabase
      .from(table)
      .select('id, text')
      .order('created_at', { ascending: false });
    

    if (!error && data) setPosts(data);
  };

  const handleCreatePost = async () => {
    const table = getTableName(board);
    if (!table) return;

    const { error } = await supabase.from(table).insert([
      {
        text: body,
      },
    ]);

    if (error) {
      setMessage('게시글 등록 실패');
    } else {
      setMessage('게시글 등록 완료!');
      setTitle('');
      setBody('');
      setImage(null);
      fetchPosts(board);
    }
  };

  const handleDeletePost = async (id: number) => {
    const table = getTableName(board);
    if (!table) return;

    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) {
      setMessage('삭제 실패');
    } else {
      setMessage('삭제 완료');
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
        <option value="프로젝트">프로젝트</option>
        <option value="스터디">스터디</option>
      </select>

      {/* 새 게시글 작성 */}
      <div className="mb-8 border-transoarent p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">새 게시글 작성</h2>
        <textarea
          placeholder="내용"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border px-3 py-2 mb-2 rounded"
        />
        <div className="flex items-center justify-end space-x-3">
          {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
          <button
            onClick={handleCreatePost}
            className="bg-gray-700 text-white px-4 py-2 rounded"
          >
            등록하기
          </button>
        </div>
      </div>

      {/* 게시글 리스트 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{board} 리스트</h2>
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="border rounded p-3 flex justify-between items-center"
            >
              <div>
                {/* <h3 className="font-semibold">{post.title}</h3> */}
                <p className="text-sm text-gray-600">{post.text}</p>
              </div>
              <button
                onClick={() => handleDeletePost(post.id)}
                className="bg-gray-700 text-white px-2 py-1 rounded"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
