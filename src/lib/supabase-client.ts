import { supabase } from './supabase';

export interface InvestmentJournal {
  id?: string;
  userId: string;
  date: string;
  totalAssets: number;
  evaluation: number;
  cashAssets: number;
  stockAssets: number;
  bondAssets: number;
  etcAssets: number;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 숫자를 안전한 정수로 변환하는 헬퍼 함수
const toSafeInteger = (value: number | string): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Math.round(num || 0);
};

// 사용자 프로필 관련 함수들
export const createOrUpdateUserProfile = async (userId: string, profile: any): Promise<void> => {
  try {
    const profileData = {
      id: userId,
      email: profile.email,
      display_name: profile.displayName,
      photo_url: profile.photoURL || null,
      is_public: profile.isPublic !== undefined ? profile.isPublic : false,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('users')
      .upsert(profileData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('사용자 프로필 저장 실패:', error);
      throw error;
    }
    console.log('Supabase 프로필 저장 성공');
  } catch (error) {
    console.error('사용자 프로필 저장 실패:', error);
    throw error;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  return createOrUpdateUserProfile(profile.id, profile);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('사용자 프로필 조회 실패:', error);
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      photoURL: data.photo_url,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('사용자 프로필 조회 실패:', error);
    throw error;
  }
};

// 투자일지 관련 함수들
export const saveJournal = async (userId: string, journal: Omit<InvestmentJournal, 'id' | 'userId'>): Promise<string> => {
  try {
    const journalData = {
      user_id: userId,
      date: journal.date,
      total_assets: toSafeInteger(journal.totalAssets),
      evaluation: toSafeInteger(journal.evaluation),
      cash_assets: toSafeInteger(journal.cashAssets || 0),
      stock_assets: toSafeInteger(journal.stockAssets || 0),
      bond_assets: toSafeInteger(journal.bondAssets || 0),
      etc_assets: toSafeInteger(journal.etcAssets || 0),
      memo: journal.memo || null,
      updated_at: new Date().toISOString()
    };

    console.log('저장할 일지 데이터 (정수 변환됨):', journalData);

    const { data, error } = await supabase
      .from('investment_journals')
      .upsert(journalData, { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase 일지 저장 실패:', error);
      throw error;
    }

    console.log('Supabase 일지 저장 성공:', data.id);
    return data.id;
  } catch (error) {
    console.error('Supabase 일지 저장 실패:', error);
    throw error;
  }
};

export const updateJournal = async (journalId: string, updates: Partial<InvestmentJournal>): Promise<void> => {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.totalAssets !== undefined) updateData.total_assets = toSafeInteger(updates.totalAssets);
    if (updates.evaluation !== undefined) updateData.evaluation = toSafeInteger(updates.evaluation);
    if (updates.cashAssets !== undefined) updateData.cash_assets = toSafeInteger(updates.cashAssets);
    if (updates.stockAssets !== undefined) updateData.stock_assets = toSafeInteger(updates.stockAssets);
    if (updates.bondAssets !== undefined) updateData.bond_assets = toSafeInteger(updates.bondAssets);
    if (updates.etcAssets !== undefined) updateData.etc_assets = toSafeInteger(updates.etcAssets);
    if (updates.memo !== undefined) updateData.memo = updates.memo || null;
    if (updates.date !== undefined) updateData.date = updates.date;

    console.log('업데이트할 일지 데이터 (정수 변환됨):', updateData);

    const { error } = await supabase
      .from('investment_journals')
      .update(updateData)
      .eq('id', journalId);

    if (error) {
      console.error('Supabase 일지 업데이트 실패:', error);
      throw error;
    }

    console.log('Supabase 일지 업데이트 성공');
  } catch (error) {
    console.error('Supabase 일지 업데이트 실패:', error);
    throw error;
  }
};

export const getUserJournals = async (userId: string): Promise<InvestmentJournal[]> => {
  try {
    const { data, error } = await supabase
      .from('investment_journals')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase 일지 조회 실패:', error);
      throw error;
    }

    const journals = data.map(item => ({
      id: item.id,
      userId: item.user_id,
      date: item.date,
      totalAssets: item.total_assets,
      evaluation: item.evaluation,
      cashAssets: item.cash_assets || 0,
      stockAssets: item.stock_assets || 0,
      bondAssets: item.bond_assets || 0,
      etcAssets: item.etc_assets || 0,
      memo: item.memo,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    console.log('Supabase 일지 조회 성공:', journals.length, '개');
    return journals;
  } catch (error) {
    console.error('Supabase 일지 조회 실패:', error);
    throw error;
  }
};

export const deleteJournal = async (journalId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('investment_journals')
      .delete()
      .eq('id', journalId);

    if (error) {
      console.error('Supabase 일지 삭제 실패:', error);
      throw error;
    }

    console.log('Supabase 일지 삭제 성공');
  } catch (error) {
    console.error('Supabase 일지 삭제 실패:', error);
    throw error;
  }
};

export const searchUsers = async (query: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_public', true)
      .ilike('display_name', `%${query}%`);
    
    if (error) throw error;
    
    const results: any[] = [];
    
    for (const profile of data) {
      const { data: journals } = await supabase
        .from('investment_journals')
        .select('date')
        .eq('user_id', profile.id)
        .order('date', { ascending: false });
      
      results.push({
        uid: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        photoURL: profile.photo_url || '',
        journalCount: journals?.length || 0,
        lastJournalDate: journals?.[0]?.date || ''
      });
    }
    
    return results;
  } catch (error) {
    console.error('사용자 검색 실패:', error);
    return [];
  }
};

export const getPublicJournals = async () => {
  try {
    const { data, error } = await supabase
      .from('investment_journals')
      .select(`
        *,
        users!inner(display_name, photo_url, is_public)
      `)
      .eq('users.is_public', true)
      .order('date', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    return data.map(journal => ({
      id: journal.id,
      userId: journal.user_id,
      date: journal.date,
      totalAssets: journal.total_assets,
      evaluation: journal.evaluation,
      cashAssets: journal.cash_assets || 0,
      stockAssets: journal.stock_assets || 0,
      bondAssets: journal.bond_assets || 0,
      etcAssets: journal.etc_assets || 0,
      memo: journal.memo || '',
      userName: journal.users.display_name,
      userPhotoURL: journal.users.photo_url
    }));
  } catch (error) {
    console.error('공개 일지 조회 실패:', error);
    return [];
  }
};