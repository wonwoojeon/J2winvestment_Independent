import { supabase } from './supabase';
import { InvestmentJournal, UserProfile, PublicJournalSearchResult } from '@/types/investment';
import { getImportantMemoTag, hasImportantMemo, normalizeMemoEntries } from '@/utils/memo';

// 🔥 사용자 프로필 관련 함수들 - avatar_url 제거
export async function createUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([
        {
          user_id: userId,
          nickname: profileData.nickname,
          display_name: profileData.display_name,
          bio: profileData.bio,
          is_public: profileData.is_public || false,
          hide_asset_amounts: profileData.hide_asset_amounts || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('사용자 프로필 생성 실패:', error);
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('사용자 프로필 조회 실패:', error);
    return null;
  }
}

export async function updateUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('사용자 프로필 업데이트 실패:', error);
    return null;
  }
}

// 🔥 공개 일지 검색 함수 - 본인 일지도 포함하도록 개선
export async function searchPublicJournals(nickname: string): Promise<PublicJournalSearchResult[]> {
  try {
    console.log('🔍 공개 일지 검색 시작:', nickname || '(전체)');
    
    // 현재 로그인한 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    let query = supabase
      .from('investment_journals')
      .select(`
        *,
        user_profiles!inner (
          id,
          user_id,
          nickname,
          display_name,
          bio,
          is_public,
          hide_asset_amounts,
          created_at,
          updated_at
        )
      `)
      .order('date', { ascending: false })
      .limit(50);

    if (nickname && nickname.trim()) {
      // 특정 닉네임 검색시: 공개된 일지 + 본인 일지 (공개 여부 무관)
      query = query.or(`user_profiles.nickname.ilike.%${nickname.trim()}%,and(user_profiles.nickname.ilike.%${nickname.trim()}%,user_profiles.user_id.eq.${currentUserId || 'null'})`);
    } else {
      // 전체 검색시: 공개된 일지만
      query = query.eq('user_profiles.is_public', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 결과에서 본인 일지이거나 공개된 일지만 필터링
    const filteredData = (data || []).filter(item => {
      const isOwnJournal = item.user_profiles.user_id === currentUserId;
      const isPublic = item.user_profiles.is_public;
      return isOwnJournal || isPublic;
    });

    const results: PublicJournalSearchResult[] = filteredData.map(item => ({
      journal: {
        id: item.id,
        user_id: item.user_id,
        date: item.date,
        totalAssets: item.total_assets,
        evaluation: item.evaluation || 0,
        exchangeRate: item.exchange_rate ? Number(item.exchange_rate) : undefined,
        foreignStocks: item.foreign_stocks || [],
        domesticStocks: item.domestic_stocks || [],
        cash: item.cash || { krw: 0, usd: 0 },
        cryptocurrency: item.cryptocurrency || [],
        trades: item.trades,
        psychologyCheck: item.psychology_check,
        bullMarketChecklist: item.bull_market_checklist || [],
        bearMarketChecklist: item.bear_market_checklist || [],
        marketIssues: item.market_issues,
        memo: item.memo,
        planText: item.plan_text || '',
        executionText: item.execution_text || '',
        deviationReason: item.deviation_reason || '',
        planStatus: item.plan_status || 'planned'
      },
      user_profile: item.user_profiles
    }));

    console.log('✅ 공개 일지 검색 완료:', results.length, '개 결과');
    return results;
  } catch (error) {
    console.error('❌ 공개 일지 검색 실패:', error);
    return [];
  }
}

// 🔥 닉네임으로 사용자 검색
export async function searchUsersByNickname(nickname: string): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('is_public', true)
      .ilike('nickname', `%${nickname}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('닉네임으로 사용자 검색 실패:', error);
    return [];
  }
}

// 기존 투자일지 관련 함수들
export async function saveJournalToSupabase(journal: InvestmentJournal): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('사용자 인증이 필요합니다');

    const memoEntries = normalizeMemoEntries(journal.memo);
    const journalData = {
      id: journal.id,
      user_id: user.id,
      date: journal.date,
      total_assets: journal.totalAssets,
      evaluation: journal.evaluation,
      exchange_rate: journal.exchangeRate,
      foreign_stocks: journal.foreignStocks,
      domestic_stocks: journal.domesticStocks,
      cash: journal.cash,
      cryptocurrency: journal.cryptocurrency,
      trades: journal.trades,
      psychology_check: journal.psychologyCheck,
      bull_market_checklist: journal.bullMarketChecklist,
      bear_market_checklist: journal.bearMarketChecklist,
      market_issues: journal.marketIssues,
      memo: memoEntries,
      plan_text: journal.planText || '',
      execution_text: journal.executionText || '',
      deviation_reason: journal.deviationReason || '',
      plan_status: journal.planStatus || 'planned',
      has_important_memo: hasImportantMemo(memoEntries),
      important_tag: getImportantMemoTag(memoEntries) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('investment_journals')
      .upsert(journalData);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase 일지 저장 실패:', error);
    return false;
  }
}

export async function getJournalsFromSupabase(): Promise<InvestmentJournal[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('investment_journals')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      date: item.date,
      totalAssets: item.total_assets,
      evaluation: item.evaluation || 0,
      exchangeRate: item.exchange_rate ? Number(item.exchange_rate) : undefined,
      foreignStocks: item.foreign_stocks || [],
      domesticStocks: item.domestic_stocks || [],
      cash: item.cash || { krw: 0, usd: 0 },
      cryptocurrency: item.cryptocurrency || [],
      trades: item.trades,
      psychologyCheck: item.psychology_check,
      bullMarketChecklist: item.bull_market_checklist || [],
      bearMarketChecklist: item.bear_market_checklist || [],
      marketIssues: item.market_issues,
      memo: item.memo,
      planText: item.plan_text || '',
      executionText: item.execution_text || '',
      deviationReason: item.deviation_reason || '',
      planStatus: item.plan_status || 'planned'
    }));
  } catch (error) {
    console.error('Supabase 일지 조회 실패:', error);
    return [];
  }
}

export async function deleteJournalFromSupabase(journalId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('사용자 인증이 필요합니다');

    const { error } = await supabase
      .from('investment_journals')
      .delete()
      .eq('id', journalId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase 일지 삭제 실패:', error);
    return false;
  }
}
