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

  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState('');
  const [semester, setSemester] = useState('');
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [members, setMembers] = useState('');
  const [techStack, setTechStack] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');

  const proj_baseUrl = process.env.NEXT_PUBLIC_PROJECT_STORAGE_URL;


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
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      // tech_stack 변환
      const parsedPosts = data.map(post => ({
        ...post,
        tech_stack: post.tech_stack?.stack ?? [],
      }));
      setPosts(parsedPosts);
    };
  }

  // 새글 등록
  const handleCreatePost = async () => {
    const table = getTableName(board);
    if (!table) return;

    let imageUrl = null;

    // --- 프로젝트일 때만 이미지 업로드 ---
    if (board === '프로젝트' && image) {
      const fileName = `${Date.now()}_${image.name}`;
      const { error: uploadError } = await supabase.storage
        .from('project_img')
        .upload(fileName, image,{contentType:image.type});

      if (uploadError) {
        console.log(uploadError);
        setMessage('이미지 업로드 실패');
        return;
      }
      imageUrl = fileName;
    }

    let payload: any = {};
    if (board === '공지') {
      payload = { text: body };
    } 
    else if (board === '프로젝트') {
      payload = {
        text: title,
        duration,
        category,
        semester,
        team_size: teamSize,
        members,
        description: body,
        detailed_description: detailedDescription,
        tech_stack: JSON.stringify({ stack: techStack.split(',').map(s => s.trim()) }),
        image_url: imageUrl,
      };
    }

    const { error } = await supabase.from(table).insert([payload]);
    if (error) {
      setMessage('게시글 등록 실패');
    } else {
      setMessage('게시글 등록 완료!');
      resetForm();
      fetchPosts(board);
    }
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setDuration('');
    setCategory('');
    setSemester('');
    setTeamSize(null);
    setMembers('');
    setTechStack('');
    setDetailedDescription('');
    setImage(null);
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
    <div className="max-w-5xl mx-auto py-8 px-4">
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

      {/* 새 글 작성 */}
      <div className="mb-8 border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">새 게시글 작성</h2>

        {board === '공지' && (
          <textarea
            placeholder="내용"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border px-3 py-2 mb-2 rounded"
          />
        )}

        {board === '프로젝트' && (
          <div className="space-y-2">
            <input className="w-full border px-3 py-2 rounded" placeholder="프로젝트명" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="w-full border px-3 py-2 rounded" placeholder="기간" value={duration} onChange={(e) => setDuration(e.target.value)} />
            <input className="w-full border px-3 py-2 rounded" placeholder="카테고리" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className="w-full border px-3 py-2 rounded" placeholder="학기 (예: 2024-2)" value={semester} onChange={(e) => setSemester(e.target.value)} />
            <input className="w-full border px-3 py-2 rounded" type="number" placeholder="팀 규모" value={teamSize ?? ''} onChange={(e) => setTeamSize(Number(e.target.value))} />
            <input className="w-full border px-3 py-2 rounded" placeholder="팀원 (쉼표 구분)" value={members} onChange={(e) => setMembers(e.target.value)} />
            <textarea className="w-full border px-3 py-2 rounded" placeholder="간단 설명" value={body} onChange={(e) => setBody(e.target.value)} />
            <textarea className="w-full border px-3 py-2 rounded" placeholder="상세 설명" value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} />
            <input className="w-full border px-3 py-2 rounded" placeholder="기술스택 (쉼표로 구분)" value={techStack} onChange={(e) => setTechStack(e.target.value)} />
            <input type="file" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 mt-3">
          {message && <p className="text-sm text-gray-600">{message}</p>}
          <button onClick={handleCreatePost} className="bg-gray-700 text-white px-4 py-2 rounded">
            등록하기
          </button>
        </div>
      </div>

      {/* 게시글 리스트 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{board} 리스트</h2>
        <ul className="space-y-3">
          {posts.map((post) => (
            
            <li key={post.id} className="border rounded p-3 flex justify-between items-start gap-3">
              <div className="flex-1">
                {board === '공지' && <p className="text-sm text-gray-700">{post.text}</p>}

                {board === '프로젝트' && (
                  <div>
                    <h3 className="font-semibold text-lg">{post.text}</h3>
                    <p className="text-sm text-gray-600">{post.description}</p>
                    <p className="text-xs text-gray-500">{post.duration} / {post.category} / {post.semester} / {post.tech_stack.join(', ')}</p>
                    {post.image_url && (
                      <img
                        src={`${proj_baseUrl}${post.image_url}`}
                        alt={post.text}
                        className="w-40 h-24 object-cover mt-2 rounded"
                      />
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => handleDeletePost(post.id)} className="bg-gray-700 text-white px-2 py-1 rounded">
                Del
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
