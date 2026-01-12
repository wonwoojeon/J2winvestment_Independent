import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Search, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PublicJournalSearch } from './PublicJournalSearch';
import { PublicJournalSearchResult } from '@/types/investment';

interface LoginModalProps {
  onClose: () => void;
  onLogin: () => void;
  onPublicJournalView: (result: PublicJournalSearchResult) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin, onPublicJournalView }) => {
  const [loading, setLoading] = useState(false);
  const [showPublicSearch, setShowPublicSearch] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      console.log('🔐 구글 로그인 시작...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('❌ 구글 로그인 실패:', error);
        alert(`로그인 실패: ${error.message}`);
        return;
      }

      console.log('✅ 구글 로그인 성공:', data);
      onLogin();
    } catch (error) {
      console.error('❌ 로그인 처리 중 오류:', error);
      alert('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublicJournalSelect = (result: PublicJournalSearchResult) => {
    setShowPublicSearch(false);
    onPublicJournalView(result);
  };

  if (showPublicSearch) {
    return (
      <PublicJournalSearch
        onJournalSelect={handlePublicJournalSelect}
        onClose={() => setShowPublicSearch(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="bg-gray-700 p-6">
          <CardTitle className="text-center text-2xl font-bold text-white">
            투자일지 플랫폼
          </CardTitle>
          <p className="text-center text-gray-400 mt-2">
            투자 기록을 체계적으로 관리하세요
          </p>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4">
          {/* 구글 로그인 버튼 */}
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                로그인 중...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <LogIn className="h-5 w-5 mr-2" />
                구글로 로그인
              </div>
            )}
          </Button>

          {/* 구분선 */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-600"></div>
            <span className="px-4 text-gray-400 text-sm">또는</span>
            <div className="flex-1 border-t border-gray-600"></div>
          </div>

          {/* 공개 일지 검색 버튼 */}
          <Button
            onClick={() => setShowPublicSearch(true)}
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 py-3 text-lg"
          >
            <div className="flex items-center justify-center">
              <Search className="h-5 w-5 mr-2" />
              다른 사용자 일지 검색
            </div>
          </Button>

          {/* 안내 메시지 */}
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h3 className="text-white font-medium mb-2">💡 이용 안내</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• <strong>구글 로그인:</strong> 개인 투자일지 작성 및 관리</li>
              <li>• <strong>사용자 검색:</strong> 공개된 다른 사용자의 일지 열람</li>
              <li>• <strong>로그인 없이도</strong> 공개 일지 검색 가능</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
