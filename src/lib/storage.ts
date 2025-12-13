import { InvestmentJournal } from '../types/investment';

// 로컬 스토리지 키
const JOURNALS_KEY = 'investment-journals';

// ID 생성 함수
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 🔥 기본 체크리스트 데이터 - 복구된 버전
export const getDefaultChecklists = () => {
  return {
    bullMarket: [
      "시장이 과열되고 있는가? (P/E 비율, 밸류에이션 확인)",
      "호르몬의변화가 일어났는가?",
      "신규 투자자들이 대거 유입되고 있는가?",
      "레버리지/마진 거래가 급증하고 있는가?",
      "암호화폐나 밈주식에 과도한 관심이 쏠리고 있는가?",
      "언론에서 '이번엔 다르다'는 식의 보도가 나오고 있는가?",
      "주식얘기가 나오면 답답해서 한소리하고싶은가?",
      "내 포트폴리오 수익률이 과도하게 높은가?",
      "FOMO(Fear of Missing Out) 심리가 강해지고 있는가?",
      "시장 참여자들을 과소평가하고 있는가?"
    ],
    bearMarket: [
      "똑똑한척 하면서 전에는 없었던 부정적인 전망을 내놓는 전문가들에게 대중이 집중이 되는가?",
      "주식장을 쳐다도 보기싫은가?",
      "언론에서 '낙담의 주파수를'퍼트리는 보도가 나오고 있는가?",
      "낙담했는가?",
      "현금이 너무나 귀하고 지금이라도 얼마정도를 더 챙겨야한다는 불안감이 엄습했는가?",
      "호르몬의 변화가 일어나 공감능력이 올라갔는가?",
      "작아보였던 금액이 너무나 소중하고 돈에 관련해서 얘기가나오면 스트레스가 받는가?",
      "직장인들이 부러운가?",
      "장기 투자 관점에서 매수 기회가 보이는가?",
      "억울한가?"
    ]
  };
};

// 일지 저장
export const saveJournal = (journal: InvestmentJournal): void => {
  try {
    const journals = getJournals();
    const existingIndex = journals.findIndex(j => j.id === journal.id);
    
    if (existingIndex >= 0) {
      journals[existingIndex] = journal;
    } else {
      journals.push(journal);
    }
    
    localStorage.setItem(JOURNALS_KEY, JSON.stringify(journals));
  } catch (error) {
    console.error('일지 저장 실패:', error);
  }
};

// 일지 목록 가져오기
export const getJournals = (): InvestmentJournal[] => {
  try {
    const stored = localStorage.getItem(JOURNALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('일지 로드 실패:', error);
    return [];
  }
};

// 일지 삭제
export const deleteJournal = (id: string): void => {
  try {
    const journals = getJournals();
    const filtered = journals.filter(j => j.id !== id);
    localStorage.setItem(JOURNALS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('일지 삭제 실패:', error);
  }
};

// 특정 일지 가져오기
export const getJournalById = (id: string): InvestmentJournal | null => {
  try {
    const journals = getJournals();
    return journals.find(j => j.id === id) || null;
  } catch (error) {
    console.error('일지 조회 실패:', error);
    return null;
  }
};

// 로컬 스토리지 초기화
export const clearAllJournals = (): void => {
  try {
    localStorage.removeItem(JOURNALS_KEY);
  } catch (error) {
    console.error('일지 초기화 실패:', error);
  }
};