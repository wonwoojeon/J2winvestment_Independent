export interface Stock {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
}

export interface Cash {
  krw: number;
  usd: number;
}

export interface PsychologyCheck {
  fearGreedIndex: number;
  confidenceLevel?: string;
  m2MoneySupply?: string;
  marginDebt?: string; // 🔥 신용잔고(마진 부채) 추가
  marginRatio?: string; // 🔥 신용잔고비율 추가
  marketSentiments?: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface InvestmentJournal {
  id: string;
  date: string;
  totalAssets: number;
  evaluation: number;
  foreignStocks: Stock[];
  domesticStocks: Stock[];
  cash: Cash;
  cryptocurrency: Stock[];
  trades?: string;
  psychologyCheck?: PsychologyCheck;
  bullMarketChecklist: ChecklistItem[];
  bearMarketChecklist: ChecklistItem[];
  marketIssues?: string;
  memo?: string;
}

// 🔥 사용자 프로필 인터페이스 추가
export interface UserProfile {
  id: string;
  user_id: string;
  nickname?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

// 🔥 공개 일지 검색 결과 인터페이스
export interface PublicJournalSearchResult {
  journal: InvestmentJournal;
  user_profile: UserProfile;
  match_score?: number;
}