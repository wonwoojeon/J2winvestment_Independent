import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, User, BarChart3 } from 'lucide-react';

// 🔥 함수 직접 정의 - import 문제 해결
const formatKoreanCurrency = (amount: number): string => {
  if (amount === 0) return "0원";
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  
  const eok = Math.floor(absAmount / 100000000);
  const remainder1 = absAmount % 100000000;
  const cheonman = Math.floor(remainder1 / 10000000);
  const remainder2 = remainder1 % 10000000;
  const man = Math.floor(remainder2 / 10000);
  
  let result = "";
  
  if (eok > 0) {
    result += `${eok}억`;
    if (cheonman > 0) {
      result += ` ${cheonman}천만`;
    } else if (man > 0) {
      result += ` ${man}만`;
    }
  } else if (cheonman > 0) {
    result += `${cheonman}천만`;
    if (man > 0) {
      result += ` ${man}만`;
    }
  } else if (man > 0) {
    result += `${man}만`;
  } else {
    const roundedMan = Math.round(absAmount / 10000);
    if (roundedMan > 0) {
      result += `${roundedMan}만`;
    } else {
      result = "1만";
    }
  }
  
  result += "원";
  return isNegative ? `-${result}` : result;
};

export interface PublicJournalSearchResult {
  id: string;
  date: string;
  total_assets: number;
  evaluation: number;
  foreign_stocks: any[];
  domestic_stocks: any[];
  cash: { krw: number; usd: number };
  cryptocurrency: any[];
  trades: string;
  psychology_check: any;
  bull_market_checklist: string[];
  bear_market_checklist: string[];
  market_issues: string;
  memo: unknown;
  user_profile: {
    nickname: string;
    bio: string;
    avatar_url: string;
  };
}

interface UserProfile {
  user_id: string;
  nickname: string;
  bio: string;
  avatar_url: string;
  is_public: boolean;
  latest_assets: number;
  journal_count: number;
  total_return: number;
}

interface PublicJournalSearchProps {
  onJournalSelect: (result: PublicJournalSearchResult) => void;
  onClose: () => void;
  onUserChartView: (userProfile: UserProfile) => void;
}

export const PublicJournalSearch: React.FC<PublicJournalSearchProps> = ({
  onJournalSelect,
  onClose,
  onUserChartView
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserProfiles();
  }, []);

  const loadUserProfiles = async () => {
    try {
      setLoading(true);
      console.log('🔍 사용자 프로필 로드 시작...');
      
      // 사용자 프로필 가져오기
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_public', true)
        .not('nickname', 'is', null)
        .limit(20);

      if (profileError) {
        console.error('❌ 프로필 로드 에러:', profileError);
        throw profileError;
      }

      console.log('📋 로드된 프로필:', profiles?.length || 0, '개');

      if (!profiles || profiles.length === 0) {
        setUserProfiles([]);
        return;
      }

      // 각 사용자의 최신 자산 정보와 일지 개수, 수익률 계산
      const enrichedProfiles = await Promise.all(
        profiles.map(async (profile) => {
          try {
            // 🔧 수정: is_public 조건 제거하여 모든 일지 검색
            const { data: journals, error: journalError } = await supabase
              .from('investment_journals')
              .select('total_assets, date')
              .eq('user_id', profile.user_id)
              .order('date', { ascending: true });

            if (journalError) {
              console.warn('⚠️ 일지 로드 에러 (사용자:', profile.nickname, '):', journalError);
              return {
                ...profile,
                latest_assets: 0,
                journal_count: 0,
                total_return: 0
              };
            }

            if (!journals || journals.length === 0) {
              return {
                ...profile,
                latest_assets: 0,
                journal_count: 0,
                total_return: 0
              };
            }

            const firstAssets = journals[0].total_assets || 0;
            const latestAssets = journals[journals.length - 1].total_assets || 0;
            const totalReturn = firstAssets > 0 ? ((latestAssets - firstAssets) / firstAssets) * 100 : 0;

            console.log('📊 사용자', profile.nickname, '통계:', {
              journal_count: journals.length,
              latest_assets: latestAssets,
              total_return: totalReturn.toFixed(2) + '%'
            });

            return {
              ...profile,
              latest_assets: latestAssets,
              journal_count: journals.length,
              total_return: Math.round(totalReturn * 100) / 100
            };
          } catch (error) {
            console.error('❌ 사용자', profile.nickname, '데이터 처리 실패:', error);
            return {
              ...profile,
              latest_assets: 0,
              journal_count: 0,
              total_return: 0
            };
          }
        })
      );

      // 일지가 있는 사용자만 필터링하고 최신 자산 기준으로 정렬
      const sortedProfiles = enrichedProfiles
        .filter(profile => profile.journal_count > 0)
        .sort((a, b) => b.latest_assets - a.latest_assets);
      
      console.log('✅ 최종 사용자 목록:', sortedProfiles.length, '명');
      setUserProfiles(sortedProfiles);

    } catch (error) {
      console.error('❌ 사용자 프로필 로드 실패:', error);
      // 사용자에게 친화적인 에러 메시지
      setUserProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadUserProfiles();
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 사용자 검색 시작:', searchTerm);
      
      // 사용자 검색
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('nickname', `%${searchTerm}%`)
        .eq('is_public', true)
        .not('nickname', 'is', null)
        .limit(20);

      if (error) {
        console.error('❌ 검색 에러:', error);
        throw error;
      }

      console.log('📋 검색된 프로필:', profiles?.length || 0, '개');

      if (!profiles || profiles.length === 0) {
        setUserProfiles([]);
        return;
      }

      // 각 사용자의 통계 계산
      const enrichedProfiles = await Promise.all(
        profiles.map(async (profile) => {
          try {
            // 🔧 수정: is_public 조건 제거
            const { data: journals, error: journalError } = await supabase
              .from('investment_journals')
              .select('total_assets, date')
              .eq('user_id', profile.user_id)
              .order('date', { ascending: true });

            if (journalError) {
              console.warn('⚠️ 검색 중 일지 로드 에러 (사용자:', profile.nickname, '):', journalError);
              return {
                ...profile,
                latest_assets: 0,
                journal_count: 0,
                total_return: 0
              };
            }

            if (!journals || journals.length === 0) {
              return {
                ...profile,
                latest_assets: 0,
                journal_count: 0,
                total_return: 0
              };
            }

            const firstAssets = journals[0].total_assets || 0;
            const latestAssets = journals[journals.length - 1].total_assets || 0;
            const totalReturn = firstAssets > 0 ? ((latestAssets - firstAssets) / firstAssets) * 100 : 0;

            return {
              ...profile,
              latest_assets: latestAssets,
              journal_count: journals.length,
              total_return: Math.round(totalReturn * 100) / 100
            };
          } catch (error) {
            console.error('❌ 검색 중 사용자', profile.nickname, '데이터 처리 실패:', error);
            return {
              ...profile,
              latest_assets: 0,
              journal_count: 0,
              total_return: 0
            };
          }
        })
      );

      const filteredProfiles = enrichedProfiles.filter(profile => profile.journal_count > 0);
      console.log('✅ 검색 완료:', filteredProfiles.length, '명');
      setUserProfiles(filteredProfiles);

    } catch (error) {
      console.error('❌ 사용자 검색 실패:', error);
      alert('사용자 검색 중 오류가 발생했습니다. 다시 시도해주세요.');
      setUserProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-6xl">
      {/* 📱 모바일 최적화된 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-sm sm:text-base">돌아가기</span>
          </Button>
          <h1 className="text-xl sm:text-3xl font-bold text-white">사용자 검색</h1>
        </div>
      </div>

      {/* 📱 모바일 최적화된 검색 입력 */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        <Input
          type="text"
          placeholder="닉네임으로 사용자 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-sm sm:text-base"
        />
        <Button 
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-3 sm:px-4"
          size="sm"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
          ) : (
            <Search className="h-3 w-3 sm:h-4 sm:w-4" />
          )}
        </Button>
      </div>

      {/* 📱 모바일 최적화된 사용자 목록 */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">
          {!searchTerm.trim() ? '👑 인기 투자자' : `검색 결과`} ({userProfiles.length}명)
        </h2>
        
        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm sm:text-base">사용자 검색 중...</p>
          </div>
        ) : userProfiles.length === 0 ? (
          <div className="text-center text-gray-400 py-6 sm:py-8">
            <User className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-sm sm:text-base">
              {searchTerm.trim() ? '검색 결과가 없습니다.' : '투자일지를 작성한 사용자가 없습니다.'}
            </p>
            <p className="text-sm sm:text-base">
              {searchTerm.trim() ? '다른 닉네임으로 검색해보세요.' : '첫 번째 투자자가 되어보세요!'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[70vh] sm:h-[600px] w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {userProfiles.map((profile) => (
                <Card key={profile.user_id} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
                  <CardContent className="p-4 sm:p-6">
                    <div className="text-center mb-3 sm:mb-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-600 rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                        <User className="h-6 w-6 sm:h-8 sm:w-8 text-gray-300" />
                      </div>
                      <h3 className="font-semibold text-white text-base sm:text-lg mb-1">
                        {profile.nickname}
                      </h3>
                      {profile.bio && (
                        <p className="text-gray-400 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">
                          {profile.bio.length > (window.innerWidth < 640 ? 40 : 50) 
                            ? profile.bio.substring(0, window.innerWidth < 640 ? 40 : 50) + '...' 
                            : profile.bio
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs sm:text-sm">최신 자산:</span>
                        <span className="text-green-400 font-medium text-xs sm:text-sm">
                          {formatKoreanCurrency(profile.latest_assets)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs sm:text-sm">일지 개수:</span>
                        <span className="text-blue-400 font-medium text-xs sm:text-sm">
                          {profile.journal_count}개
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-xs sm:text-sm">총 수익률:</span>
                        <span className={`font-medium text-xs sm:text-sm ${profile.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profile.total_return >= 0 ? '+' : ''}{profile.total_return.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => onUserChartView(profile)}
                      className="w-full bg-green-600 hover:bg-green-700 text-sm sm:text-base py-2"
                      size="sm"
                    >
                      <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      차트 보기
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
