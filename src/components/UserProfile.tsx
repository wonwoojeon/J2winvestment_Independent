import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUserProfile, updateUserProfile, createUserProfile } from '@/lib/database';
import { UserProfile as UserProfileType } from '@/types/investment';

interface UserProfileProps {
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileData, setProfileData] = useState<Partial<UserProfileType>>({
    nickname: '',
    display_name: '',
    bio: '',
    is_public: false
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);

      // 기존 프로필 로드
      const profile = await getUserProfile(user.id);
      
      if (profile) {
        setProfileData({
          nickname: profile.nickname || '',
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          is_public: profile.is_public || false
        });
      } else {
        // 기본값 설정
        setProfileData({
          nickname: '',
          display_name: user.email?.split('@')[0] || '',
          bio: '',
          is_public: false
        });
      }
    } catch (error) {
      console.error('❌ 사용자 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      console.log('💾 프로필 저장 시작:', profileData);

      // 닉네임 유효성 검사
      if (profileData.nickname && profileData.nickname.length < 2) {
        alert('닉네임은 2글자 이상이어야 합니다.');
        return;
      }

      // 기존 프로필이 있는지 확인
      const existingProfile = await getUserProfile(user.id);
      
      let result;
      if (existingProfile) {
        // 업데이트
        result = await updateUserProfile(user.id, profileData);
      } else {
        // 새로 생성
        result = await createUserProfile(user.id, profileData);
      }

      if (result) {
        console.log('✅ 프로필 저장 완료');
        alert('프로필이 성공적으로 저장되었습니다!');
        onClose();
      } else {
        throw new Error('프로필 저장 실패');
      }
    } catch (error) {
      console.error('❌ 프로필 저장 실패:', error);
      alert('프로필 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">프로필 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
            <h1 className="text-2xl font-bold">프로필 설정</h1>
          </div>
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>

        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="bg-gray-700 p-6">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-white">
              <User className="h-5 w-5 text-blue-400" />
              사용자 프로필
            </CardTitle>
            <p className="text-gray-400 mt-2">
              다른 사용자들이 볼 수 있는 프로필 정보를 설정하세요
            </p>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-300 mb-2 block">
                  이메일 (변경 불가)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-600 border-gray-500 text-gray-400"
                />
              </div>

              <div>
                <Label htmlFor="nickname" className="text-gray-300 mb-2 block">
                  닉네임 *
                </Label>
                <Input
                  id="nickname"
                  type="text"
                  value={profileData.nickname || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="다른 사용자들이 볼 수 있는 닉네임을 입력하세요"
                  className="bg-gray-700 border-gray-600 text-white"
                  maxLength={50}
                />
                <p className="text-xs text-gray-400 mt-1">
                  2-50글자, 다른 사용자가 검색할 때 사용됩니다
                </p>
              </div>

              <div>
                <Label htmlFor="display_name" className="text-gray-300 mb-2 block">
                  표시 이름
                </Label>
                <Input
                  id="display_name"
                  type="text"
                  value={profileData.display_name || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="프로필에 표시될 이름"
                  className="bg-gray-700 border-gray-600 text-white"
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="bio" className="text-gray-300 mb-2 block">
                  자기소개
                </Label>
                <Textarea
                  id="bio"
                  value={profileData.bio || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="간단한 자기소개를 작성해주세요"
                  rows={4}
                  className="bg-gray-700 border-gray-600 text-white"
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {(profileData.bio || '').length}/500글자
                </p>
              </div>
            </div>

            {/* 공개 설정 */}
            <div className="border-t border-gray-600 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {profileData.is_public ? (
                      <Eye className="h-4 w-4 text-green-400" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                    <Label className="text-gray-300 font-medium">
                      프로필 공개 설정
                    </Label>
                  </div>
                  <p className="text-sm text-gray-400">
                    {profileData.is_public 
                      ? '다른 사용자들이 내 프로필과 공개 일지를 검색할 수 있습니다'
                      : '내 프로필과 일지는 나만 볼 수 있습니다'
                    }
                  </p>
                </div>
                <Switch
                  checked={profileData.is_public || false}
                  onCheckedChange={(checked) => setProfileData(prev => ({ ...prev, is_public: checked }))}
                  className="ml-4"
                />
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-2">💡 프로필 이용 안내</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• <strong>닉네임:</strong> 다른 사용자가 검색할 때 사용되는 고유 식별자</li>
                <li>• <strong>공개 설정:</strong> 활성화 시 다른 사용자들이 내 일지를 검색할 수 있음</li>
                <li>• <strong>비공개 설정:</strong> 내 일지는 나만 볼 수 있으며 검색되지 않음</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};