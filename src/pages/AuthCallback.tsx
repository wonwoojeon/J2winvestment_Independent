import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

async function saveUserProfileToSupabase(userId: string, { email, displayName, photoURL }: { email: string; displayName: string; photoURL: string }) {
  try {
    const profile = {
      id: userId,
      email: email,
      full_name: displayName || email.split('@')[0],
      avatar_url: photoURL || null,
      updated_at: new Date().toISOString(),
    };

    console.log('사용자 프로필 저장 중:', profile);

    const { error } = await supabase.from('users').upsert(profile, { onConflict: 'id' });

    if (error) {
      console.error('프로필 저장 실패:', error);
      throw error;
    }

    console.log('사용자 프로필 저장 완료');
  } catch (error) {
    console.error('saveUserProfileToSupabase 오류:', error);
    throw error;
  }
}

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('세션 가져오기 실패:', error);
          setError('인증 처리 중 오류가 발생했습니다.');
          return;
        }

        if (session?.user) {
          console.log('인증 성공:', session.user);
          
          // 사용자 프로필 저장
          await saveUserProfileToSupabase(session.user.id, {
            email: session.user.email || '',
            displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            photoURL: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || ''
          });

          // 메인 페이지로 리다이렉트
          navigate('/', { replace: true });
        } else {
          console.log('세션이 없습니다. 로그인 페이지로 이동합니다.');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('인증 콜백 처리 실패:', error);
        setError('인증 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>로그인 처리 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">오류 발생</h1>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => navigate('/', { replace: true })}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
          >
            메인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;