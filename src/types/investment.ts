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
  vixIndex?: string;
  putCallRatio?: string;
  sp500Rsi14?: string;
  dxyIndex?: string;
  us10yYield?: string;
  gdpNow?: string;
  highYieldSpread?: string;
  fedFundsProbability?: string;
  unemploymentRate?: string;
  marketSentiments?: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface MemoEntry {
  text: string;
  isImportant?: boolean;
  importantTag?: string;
}

export type PlanStatus = 'planned' | 'executed' | 'deviated';

export interface InvestmentJournal {
  id: string;
  user_id?: string;
  date: string;
  totalAssets: number;
  evaluation: number;
  exchangeRate?: number;
  foreignStocks: Stock[];
  domesticStocks: Stock[];
  cash: Cash;
  cryptocurrency: Stock[];
  trades?: string;
  psychologyCheck?: PsychologyCheck;
  bullMarketChecklist: ChecklistItem[];
  bearMarketChecklist: ChecklistItem[];
  marketIssues?: string;
  memo?: MemoEntry[] | string | null;
  planText?: string;
  executionText?: string;
  deviationReason?: string;
  planStatus?: PlanStatus;
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
  hide_asset_amounts?: boolean;
  created_at: string;
  updated_at: string;
}

// 🔥 공개 일지 검색 결과 인터페이스
export interface PublicJournalSearchResult {
  journal: InvestmentJournal;
  user_profile: UserProfile;
  match_score?: number;
}

export interface InvestmentScenario {
  id: string;
  user_id: string;
  title: string;
  hypothesis?: string;
  trigger?: string;
  invalidation?: string;
  status: 'open' | 'confirmed' | 'invalidated';
  created_at: string;
  updated_at: string;
}
