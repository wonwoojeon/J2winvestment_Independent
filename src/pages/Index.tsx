import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import JournalForm from '../components/JournalForm';
import { JournalDetail } from '../components/JournalDetail';
import { UserProfile } from '../components/UserProfile';
import { PublicJournalSearch } from '../components/PublicJournalSearch';
import { PublicJournalDetail } from '../components/PublicJournalDetail';
import { UserAssetChart } from '../components/UserAssetChart';
import { BibleVerseTicker } from '../components/BibleVerseTicker';
import AssetChangeChart from '../components/AssetChangeChart';
import { MemoList } from '../components/MemoList';
import { RiskSnapshot } from '../components/RiskSnapshot';
import { ScenarioTracker } from '../components/ScenarioTracker';
import { InvestmentJournal, PublicJournalSearchResult } from '../types/investment';
import { getImportantMemoTag, getMemoText, hasImportantMemo, normalizeMemoEntries } from '@/utils/memo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { callOpenAiProxy } from '@/lib/llm';
import { getJournalExchangeRate } from '@/utils/exchangeRate';
import { 
  User, 
  Settings, 
  Search, 
  LogOut, 
  Plus,
  PlusCircle, 
  TrendingUp, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Brain,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';

// 통화 포맷팅
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
    if (cheonman > 0) result += ` ${cheonman}천만`;
  } else if (cheonman > 0) {
    result += `${cheonman}천만`;
    if (man > 0) result += ` ${man}만`;
  } else if (man > 0) {
    result += `${man}만`;
  } else {
    const roundedMan = Math.round(absAmount / 10000);
    result += roundedMan > 0 ? `${roundedMan}만` : "1만";
  }
  result += "원";
  return isNegative ? `-${result}` : result;
};

const formatSimpleCurrency = (amount: number): string => {
  return Math.round(amount).toLocaleString('ko-KR');
};

const buildStockLine = (
  label: string,
  stocks: { symbol?: string; price?: number; quantity?: number }[] | undefined,
  exchangeRate: number,
  priceInUsd: boolean
): string => {
  if (!stocks || stocks.length === 0) return `${label}: 없음`;
  const items = stocks
    .map((stock) => {
      const price = Number(stock?.price) || 0;
      const quantity = Number(stock?.quantity) || 0;
      const value = price * quantity * (priceInUsd ? exchangeRate : 1);
      return {
        value,
        text: `${stock?.symbol || 'N/A'} ${formatKoreanCurrency(value)} (${quantity}주 x ${priceInUsd ? '$' : ''}${formatSimpleCurrency(price)})`
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  return `${label}: ${items.map((item) => item.text).join(' | ')}`;
};

const buildAssetPromptDetails = (journal: InvestmentJournal | null, exchangeRate: number): string => {
  if (!journal) return '자산 정보 없음';
  const effectiveRate = getJournalExchangeRate(journal, exchangeRate);
  const foreignTotal =
    (journal.foreignStocks || []).reduce(
      (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
      0
    ) * effectiveRate;
  const domesticTotal = (journal.domesticStocks || []).reduce(
    (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
    0
  );
  const cryptoTotal =
    (journal.cryptocurrency || []).reduce(
      (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
      0
    ) * effectiveRate;
  const cashKrw = Number(journal.cash?.krw) || 0;
  const cashUsd = Number(journal.cash?.usd) || 0;
  const cashTotal = cashKrw + cashUsd * effectiveRate;

  const totals = `자산 합계: 해외주식 ${formatKoreanCurrency(foreignTotal)}, 국내주식 ${formatKoreanCurrency(domesticTotal)}, 크립토 ${formatKoreanCurrency(cryptoTotal)}, 현금 ${formatKoreanCurrency(cashTotal)}`;
  const cashLine = `현금 상세: KRW ${formatKoreanCurrency(cashKrw)} / USD ${formatSimpleCurrency(cashUsd)} (원화환산 ${formatKoreanCurrency(cashUsd * effectiveRate)})`;
  const foreignLine = buildStockLine('해외주식 상위', journal.foreignStocks || [], effectiveRate, true);
  const domesticLine = buildStockLine('국내주식 상위', journal.domesticStocks || [], effectiveRate, false);
  const cryptoLine = buildStockLine('크립토 상위', journal.cryptocurrency || [], effectiveRate, true);

  return [totals, cashLine, foreignLine, domesticLine, cryptoLine].join('\n');
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const readCachedText = (key: string | null): string | null => {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.content === 'string' ? parsed.content : null;
  } catch {
    return null;
  }
};

const writeCachedText = (key: string | null, content: string): void => {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ content, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore cache failures
  }
};

type AiCacheType = 'summary' | 'reflection';

// 🙏 성경구절 티커 (대시보드용)
const DashboardBibleVerseTicker: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false
}) => {
  const [shuffledVerses, setShuffledVerses] = useState<string[]>([]);

  const BIBLE_VERSES = [
    "그러므로 이렇게 기도하라 - 마태복음 6:9-13",
    "여호와는 나의 목자시니 내게 부족함이 없으리로다 - 시편 23:1",
    "복 있는 사람은 악인들의 꾀를 따르지 아니하며 - 시편 1:1",
    "범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라 - 데살로니가전서 5:18",
    "항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 - 데살로니가전서 5:16-18",
    "내가 산을 향하여 눈을 들리라 나의 도움이 어디서 올까 - 시편 121:1",
    "수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라 - 마태복음 11:28",
    "내 은혜가 네게 족하도다 이는 내 능력이 약한 데서 온전하여짐이라 - 고린도후서 12:9",
    "모든 것을 할 수 있느니라 나를 능하게 하시는 자 안에서니라 - 빌립보서 4:13",
    "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 - 잠언 3:5",
    "너는 마음을 다하여 여호와를 신뢰하고 그를 인정하라 - 잠언 3:5-6",
    "여호와를 경외하는 것이 지혜의 근본이라 - 잠언 9:10",
    "여호와께서 너를 지키시며 여호와께서 네 우편에서 네 그늘이 되시나니 - 시편 121:5",
    "평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라 - 요한복음 14:27",
    "사랑하는 자들아 우리가 서로 사랑하자 사랑은 하나님께 속한 것이니라 - 요한일서 4:7",
    "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 - 요한복음 3:16",
    "염려를 다 주께 맡기라 이는 그가 너희를 돌보심이라 - 베드로전서 5:7",
    "무릇 더러운 말은 너희 입 밖에도 내지 말라 - 에베소서 4:29",
    "의인의 길은 돋는 해 빛 같아서 크게 빛나 한낮의 광명에 이르거니와 - 잠언 4:18",
    "여호와는 나의 힘이요 나의 방패시라 내 마음이 그를 의지하여 도움을 얻었도다 - 시편 28:7",
    "하나님께서 모든 것을 합력하여 선을 이루게 하시느니라 - 로마서 8:28",
    "주의 말씀은 내 발에 등이요 내 길에 빛이니이다 - 시편 119:105",
    "너희는 먼저 그의 나라와 그의 의를 구하라 - 마태복음 6:33",
    "사람이 마음으로 자기의 길을 계획할지라도 그의 걸음을 인도하시는 이는 여호와시니라 - 잠언 16:9",
    "기뻐하는 자들과 함께 기뻐하고 우는 자들과 함께 울라 - 로마서 12:15",
    "선을 행하되 낙심하지 말지니 포기하지 아니하면 때가 이르매 거두리라 - 갈라디아서 6:9",
    "주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라 - 빌립보서 4:4",
    "내 아들아 나의 법을 잊지 말고 네 마음으로 나의 명령을 지키라 - 잠언 3:1",
    "여호와의 이름은 견고한 망대라 의인은 그리로 달려가서 안전함을 얻느니라 - 잠언 18:10",
    "그런즉 믿음은 들음에서 나며 들음은 그리스도의 말씀으로 말미암았느니라 - 로마서 10:17",
    "새 힘을 얻으리니 독수리가 날개치며 올라감 같을 것이요 - 이사야 40:31",
    "여호와께서 내 편이시라 내가 두려워하지 아니하리니 사람이 내게 어찌할꼬 - 시편 118:6",
    "태초에 말씀이 계시니라 만물이 그로 말미암아 지은 바 되었으니 - 요한복음 1:1-3",
    "그가 찔림은 우리의 허물 때문이요 그가 상함은 우리의 죄악 때문이라 - 이사야 53:5",
    "그러므로 누구든지 그리스도 안에 있으면 새로운 피조물이라 - 고린도후서 5:17",
    "예수께서 이르시되 너희 믿음대로 되라 하시니 - 마태복음 9:29",
    "야베스가 이스라엘 하나님께 아뢰어 이르되 주께서 내게 복을 주시려거든 나의 지역을 넓히시고 - 역대상 4:10",
    "너희 중에 누구든지 지혜가 부족하거든 모든 사람에게 후히 주시고 꾸짖지 아니하시는 하나님께 구하라 - 야고보서 1:5",
    "그들이 부르기 전에 내가 응답하겠고 그들이 말을 마치기 전에 내가 들으리라 - 이사야 65:24",
    "기도할 때에 무엇이든지 믿고 구하는 것은 다 받으리라 하시니라 - 마태복음 21:22",
    "주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 너희 무리와 함께 있을지어다 - 고린도후서 13:14",
    "입법자와 재판관은 오직 한 분이시니 - 야고보서 4:12",
    "두려워하지 말라 내가 너와 함께함이라 - 이사야 41:10",
    "분을 그치고 노를 버리며 불평하지 말라 - 시편 37:8",
    "돈을 사랑함이 일만 악의 뿌리가 되나니 - 디모데전서 6:10",
    "돈을 사랑하지 말고 있는 바를 족한 줄로 알라 - 히브리서 13:5",
    "너희가 하나님과 재물을 겸하여 섬기지 못하느니라 - 마태복음 6:24",
    "사람의 생명이 그 소유의 넉넉한 데 있지 아니하니라 - 누가복음 12:15",
    "사람이 온 천하를 얻고도 자기 목숨을 잃으면 무엇이 유익하리요 - 마가복음 8:36",
    "자기의 재물을 의지하는 자는 패하리라 - 잠언 11:28",
    "망령되이 얻은 재물은 줄어가고 손으로 모은 것은 늘어가느니라 - 잠언 13:11",
    "속이는 저울은 여호와께서 미워하시나 공정한 추는 그가 기뻐하시느니라 - 잠언 11:1",
    "주는 것이 받는 것보다 복이 있다 하심을 기억하라 - 사도행전 20:35",
    "하나님은 즐겨 내는 자를 사랑하시느니라 - 고린도후서 9:7",
    "가난한 자를 불쌍히 여기는 것은 여호와께 꾸이는 것이니 - 잠언 19:17",
    "오직 너희를 위하여 보물을 하늘에 쌓아 두라 - 마태복음 6:20",
    "지극히 작은 것에 충성된 자는 큰 것에도 충성되고 - 누가복음 16:10",
    "네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라 - 잠언 3:9",
    "착하고 충성된 종아 네가 작은 일에 충성하였으매 - 마태복음 25:21",
    "너희는 먼저 그의 나라와 그의 의를 구하라 - 마태복음 6:33",
    "욕심이 잉태한즉 죄를 낳고 죄가 장성한즉 사망을 낳느니라 - 야고보서 1:15",
    "탐을 내는 자는 자기 집을 해롭게 하나 - 잠언 15:27",
    "부자는 가난한 자를 주관하고 빚진 자는 채주의 종이 되느니라 - 잠언 22:7",
    "무릇 이익을 탐하는 자의 길은 다 이러하여 자기의 생명을 잃게 하느니라 - 잠언 1:19",
    "사랑하는 자여 네 영혼이 잘됨 같이 네가 범사에 잘되고 강건하기를 - 요한삼서 1:2"
  ];

  useEffect(() => {
    const shuffled = [...BIBLE_VERSES].sort(() => Math.random() - 0.5);
    setShuffledVerses(shuffled);
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${compact ? 'h-10 sm:h-12' : 'h-12 sm:h-14'} ${className}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-slate-950/90 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-950/90 to-transparent z-10" />
      
      <div 
        className="flex items-center h-full animate-scroll-continuous"
        style={{
          animation: 'scroll-continuous 180s linear infinite',
          width: 'max-content',
          whiteSpace: 'nowrap'
        }}
      >
        {[...shuffledVerses, ...shuffledVerses].map((verse, index) => (
          <div key={index} className={`flex items-center gap-3 ${compact ? 'px-5' : 'px-8'}`}>
            <span className="text-cyan-300 text-base sm:text-lg opacity-80">✝</span>
            <p className={`text-slate-200/90 ${compact ? 'text-xs sm:text-sm' : 'text-sm'} font-medium tracking-wide`}>
              {verse}
            </p>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        @keyframes scroll-continuous {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-continuous {
          animation: scroll-continuous 180s linear infinite;
        }
        .animate-scroll-continuous:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

const BACKGROUND_VIDEO_URL = '/background.mp4';

const BackgroundDecor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = 0.65;
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover opacity-60"
        style={{ filter: 'saturate(1.8) hue-rotate(28deg) brightness(0.55) contrast(1.1)' }}
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={BACKGROUND_VIDEO_URL} type="video/mp4" />
      </video>
    <div className="absolute inset-0 bg-slate-950/70" />
    <div
      className="absolute inset-0 opacity-70"
      style={{
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(56,189,248,0.45), transparent 50%), radial-gradient(circle at 85% 10%, rgba(167,139,250,0.45), transparent 50%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.35), transparent 55%)'
      }}
    />
      <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-400/20 blur-[140px] mix-blend-screen" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[160px] mix-blend-screen" />
    </div>
  );
};

const FloatingVerseTicker: React.FC = () => (
  <div className="fixed top-16 sm:top-20 left-1/2 z-40 w-[min(1100px,94vw)] -translate-x-1/2 px-2">
    <DashboardBibleVerseTicker
      compact
      className="glass-panel rounded-full overflow-hidden bg-slate-950/50"
    />
  </div>
);

const PageShell: React.FC<{ children: React.ReactNode; header?: React.ReactNode }> = ({ children, header }) => (
  <div className="relative min-h-screen text-slate-100 font-sans selection:bg-cyan-400/30">
    <BackgroundDecor />
    {header}
    <div className="relative z-10 pb-20 pt-16 sm:pt-20">{children}</div>
    <FloatingVerseTicker />
  </div>
);

type TodoItem = {
  id: string;
  text: string;
  createdAt: string;
  completedAt?: string | null;
};

type TodoRow = {
  id: string;
  text: string;
  created_at: string;
  completed_at: string | null;
};

type StanceInfo = {
  stance: string;
  desc: string;
  tone: 'positive' | 'neutral' | 'warning';
};

const formatTodoDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
};

type MacroEvent = {
  name: string;
  date: string; // YYYY-MM-DD
  type: 'FOMC' | 'CPI' | 'EARNINGS' | 'OTHER';
};

// 간단한 이벤트 캘린더 (필요 시 갱신)
const macroEvents: MacroEvent[] = [
  { name: 'FOMC 회의', date: '2026-01-29', type: 'FOMC' },
  { name: '미국 CPI 발표', date: '2026-02-13', type: 'CPI' },
  { name: '실적 시즌 피크', date: '2026-02-07', type: 'EARNINGS' }
];

const computeAssetSnapshot = (journal: InvestmentJournal | null, exchangeRate: number) => {
  if (!journal) return { total: 0, cash: 0, concentration: 0, topBucket: 'N/A' };
  const effectiveRate = getJournalExchangeRate(journal, exchangeRate);
  const foreignTotal =
    (journal.foreignStocks || []).reduce(
      (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
      0
    ) * effectiveRate;
  const domesticTotal = (journal.domesticStocks || []).reduce(
    (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
    0
  );
  const cryptoTotal =
    (journal.cryptocurrency || []).reduce(
      (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
      0
    ) * effectiveRate;
  const cashKrw = Number(journal.cash?.krw) || 0;
  const cashUsd = Number(journal.cash?.usd) || 0;
  const cashTotal = cashKrw + cashUsd * effectiveRate;

  const totalAssets = journal.totalAssets || foreignTotal + domesticTotal + cryptoTotal + cashTotal;
  const buckets = [
    { label: '해외주식', value: foreignTotal },
    { label: '국내주식', value: domesticTotal },
    { label: '크립토', value: cryptoTotal },
    { label: '현금', value: cashTotal }
  ];
  const topBucket = buckets.reduce((max, item) => (item.value > max.value ? item : max), buckets[0]);
  const concentration = totalAssets > 0 ? (topBucket.value / totalAssets) * 100 : 0;
  return { total: totalAssets, cash: cashTotal, concentration, topBucket: topBucket.label };
};

const deriveStance = (journal: InvestmentJournal | null, exchangeRate: number): StanceInfo | null => {
  if (!journal) return null;
  const fg = journal.psychologyCheck?.fearGreedIndex ?? 50;
  const vix = journal.psychologyCheck?.vixIndex ? Number(journal.psychologyCheck?.vixIndex) : null;
  const { cash, total, concentration } = computeAssetSnapshot(journal, exchangeRate);
  const cashRatio = total > 0 ? (cash / total) * 100 : 0;

  if (fg <= 25) {
    return {
      stance: '공격',
      desc: '극공포 구간: 역행 매수/포지션 확대 기회. 단, 분할 매수와 손절선 점검.',
      tone: 'positive'
    };
  }
  if (fg >= 75 || concentration > 45) {
    return {
      stance: '관망/보수',
      desc: '시장 탐욕 또는 포지션 편중↑: 현금 비중 확대로 리스크 관리, 급락 대비.',
      tone: 'warning'
    };
  }
  if (cashRatio > 40 && fg < 60) {
    return {
      stance: '보수',
      desc: '현금 여유 확보 상태. 신호 확인 후 선택적 진입.',
      tone: 'neutral'
    };
  }
  if (vix !== null && vix > 20) {
    return {
      stance: '보수',
      desc: '변동성 상승(VIX>20). 진입은 분할, 익절/손절폭 축소.',
      tone: 'neutral'
    };
  }
  return {
    stance: '중립',
    desc: '균형 구간. 핵심 시나리오 점검 후 크기 조절.',
    tone: 'neutral'
  };
};

const DashboardTodoList: React.FC<{ userId?: string }> = ({ userId }) => {
  const storageKey = useMemo(() => `dashboard_todos_${userId || 'guest'}`, [userId]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadLocalItems = () => {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as TodoItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        } catch (error) {
          console.error('❌ 투두 리스트 로드 실패:', error);
        }
      }
    };

    const loadRemoteItems = async () => {
      if (!userId) return;
      setLoading(true);
      setSyncError(null);
      try {
        const { data, error } = await supabase
          .from('dashboard_todos')
          .select('id, text, created_at, completed_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const rows = (data || []) as TodoRow[];
        setItems(
          rows.map((row) => ({
            id: row.id,
            text: row.text,
            createdAt: row.created_at,
            completedAt: row.completed_at
          }))
        );
      } catch (error) {
        console.error('❌ 투두 리스트 동기화 실패:', error);
        setSyncError('동기화 실패');
        loadLocalItems();
      } finally {
        setLoading(false);
      }
    };

    setItems([]);
    if (userId) {
      loadRemoteItems();
    } else {
      loadLocalItems();
    }
  }, [storageKey, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput, isOpen]);

  const activeItems = items
    .filter((item) => !item.completedAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const completedItems = items
    .filter((item) => item.completedAt)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  const handleAddItem = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!userId) {
      const nextItem: TodoItem = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      setItems((prev) => [...prev, nextItem]);
      setInputValue('');
      setShowInput(false);
      setIsOpen(true);
      return;
    }

    try {
      setSyncError(null);
      const { data, error } = await supabase
        .from('dashboard_todos')
        .insert({
          user_id: userId,
          text: trimmed,
          created_at: new Date().toISOString(),
          completed_at: null
        })
        .select('id, text, created_at, completed_at')
        .single();
      if (error) throw error;
      const row = data as TodoRow;
      setItems((prev) => [
        ...prev,
        {
          id: row.id,
          text: row.text,
          createdAt: row.created_at,
          completedAt: row.completed_at
        }
      ]);
      setInputValue('');
      setShowInput(false);
      setIsOpen(true);
    } catch (error) {
      console.error('❌ 투두 추가 실패:', error);
      setSyncError('추가 실패');
    }
  };

  const handleToggleComplete = async (id: string, checked: boolean) => {
    const completedAt = checked ? new Date().toISOString() : null;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, completedAt }
          : item
      )
    );
    if (!userId) return;
    try {
      setSyncError(null);
      const { error } = await supabase
        .from('dashboard_todos')
        .update({ completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('❌ 완료 상태 업데이트 실패:', error);
      setSyncError('업데이트 실패');
    }
  };

  const startEditing = (item: TodoItem) => {
    setEditingId(item.id);
    setEditText(item.text);
    const completedDate = item.completedAt
      ? item.completedAt.split('T')[0]
      : new Date().toISOString().split('T')[0];
    setEditDate(completedDate);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const currentItem = items.find((item) => item.id === editingId);
    if (!currentItem) return;
    const trimmed = editText.trim();
    const nextText = trimmed || currentItem.text;
    const nextCompletedAt = editDate
      ? new Date(editDate).toISOString()
      : currentItem.completedAt;
    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              text: nextText,
              completedAt: nextCompletedAt
            }
          : item
      )
    );
    if (userId) {
      try {
        setSyncError(null);
        const { error } = await supabase
          .from('dashboard_todos')
          .update({
            text: nextText,
            completed_at: nextCompletedAt
          })
          .eq('id', editingId)
          .eq('user_id', userId);
        if (error) throw error;
      } catch (error) {
        console.error('❌ 완료 항목 수정 실패:', error);
        setSyncError('수정 실패');
      }
    }
    setEditingId(null);
  };

  const handleDeleteItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    if (!userId) return;
    try {
      setSyncError(null);
      const { error } = await supabase
        .from('dashboard_todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('❌ 완료 항목 삭제 실패:', error);
      setSyncError('삭제 실패');
    }
  };

  return (
    <div className="glass-panel bg-slate-950/40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-slate-100 font-semibold">To do List</span>
          {loading && <span className="text-xs text-slate-300/60">동기화 중...</span>}
          {syncError && <span className="text-xs text-rose-300">{syncError}</span>}
          <span className="text-xs text-slate-300/70">
            진행 {activeItems.length} · 완료 {completedItems.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:bg-slate-800"
            onClick={() => {
              setIsOpen(true);
              setShowInput(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? '접기' : '펼치기'}
            {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {showInput && (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                  if (e.key === 'Escape') {
                    setShowInput(false);
                    setInputValue('');
                  }
                }}
                placeholder="할 일을 입력하세요"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddItem}
              >
                추가
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {activeItems.length === 0 ? (
              <div className="text-sm text-slate-500">지금은 할 일이 없어요.</div>
            ) : (
              activeItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.completedAt)}
                    onChange={(e) => handleToggleComplete(item.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <span className="flex-1">{item.text}</span>
                  <span className="text-xs text-slate-500">
                    {formatTodoDate(item.createdAt)}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="border-t border-slate-800 pt-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
              onClick={() => setCompletedOpen((prev) => !prev)}
            >
              완료 목록 {completedItems.length}개
              {completedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {completedOpen && (
              <div className="mt-3 space-y-2">
                {completedItems.length === 0 ? (
                  <div className="text-sm text-slate-500">완료된 항목이 없습니다.</div>
                ) : (
                  completedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400"
                    >
                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                            <Button
                              type="button"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={handleSaveEdit}
                            >
                              저장
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                              onClick={() => setEditingId(null)}
                            >
                              취소
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 text-left"
                          onClick={() => startEditing(item)}
                        >
                          <span className="flex-1 line-through">{item.text}</span>
                          {item.completedAt && (
                            <span className="text-xs text-slate-500">
                              완료 {formatTodoDate(item.completedAt)}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function Index() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'list' | 'form' | 'detail' | 'profile' | 'publicSearch' | 'publicDetail' | 'userChart' | 'memoList'>('list');
  const [selectedJournal, setSelectedJournal] = useState<InvestmentJournal | null>(null);
  const [publicJournalResult, setPublicJournalResult] = useState<PublicJournalSearchResult | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [journals, setJournals] = useState<InvestmentJournal[]>([]);
  const [exchangeRate] = useState(1300);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stanceCard, setStanceCard] = useState<StanceInfo | null>(null);
  const [coreAlerts, setCoreAlerts] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [reflectionText, setReflectionText] = useState<string>('');
  const [reflectionLoading, setReflectionLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        loadJournals();
        loadUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        loadJournals();
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setJournals([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setUserProfile(profile);
    } catch (error) {
      console.error('❌ 사용자 프로필 로드 실패:', error);
    }
  };

  const loadJournals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('investment_journals')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      
      const convertedJournals = (data || []).map(journal => ({
        id: journal.id,
        user_id: journal.user_id,
        date: journal.date || new Date().toISOString().split('T')[0],
        totalAssets: journal.total_assets || 0,
        evaluation: journal.evaluation || 0,
        exchangeRate: journal.exchange_rate ? Number(journal.exchange_rate) : undefined,
        foreignStocks: Array.isArray(journal.foreign_stocks) ? journal.foreign_stocks : [],
        domesticStocks: Array.isArray(journal.domestic_stocks) ? journal.domestic_stocks : [],
        cash: journal.cash || { krw: 0, usd: 0 },
        cryptocurrency: Array.isArray(journal.cryptocurrency) ? journal.cryptocurrency : [],
        trades: journal.trades || '',
        psychologyCheck: journal.psychology_check || { fearGreedIndex: 50 },
        bullMarketChecklist: Array.isArray(journal.bull_market_checklist) ? journal.bull_market_checklist : [],
        bearMarketChecklist: Array.isArray(journal.bear_market_checklist) ? journal.bear_market_checklist : [],
        marketIssues: journal.market_issues || '',
        memo: journal.memo ?? '',
        planText: journal.plan_text || '',
        executionText: journal.execution_text || '',
        deviationReason: journal.deviation_reason || '',
        planStatus: journal.plan_status || 'planned'
      }));
      
      setJournals(convertedJournals);
    } catch (error) {
      console.error('❌ 일지 로드 실패:', error);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) console.error('로그인 오류:', error);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('로그아웃 오류:', error);
    setCurrentView('list');
    setMobileMenuOpen(false);
  };

  const handleChartPointClick = (date: string) => {
    const journal = journals.find(j => j.date === date);
    if (journal) {
      setSelectedJournal(journal);
      setCurrentView('detail');
    } else {
      alert(`${date}에 작성된 일지가 없습니다.`);
    }
  };

  const handleJournalClick = (journal: InvestmentJournal) => {
    setSelectedJournal(journal);
    setCurrentView('detail');
  };

  const handleJournalDelete = async (journalId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('investment_journals')
        .delete()
        .eq('id', journalId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadJournals();
      setCurrentView('list');
      setSelectedJournal(null);
      alert('일지가 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('❌ 일지 삭제 실패:', error);
      alert('일지 삭제에 실패했습니다.');
    }
  };

  const handleMemoDelete = async (journalId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('investment_journals')
        .update({ 
          memo: [],
          has_important_memo: false,
          important_tag: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', journalId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadJournals();
      
      if (selectedJournal && selectedJournal.id === journalId) {
        setSelectedJournal(prev => prev ? { ...prev, memo: [] } : null);
      }
      
      alert('메모가 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('❌ 메모 삭제 실패:', error);
      alert('메모 삭제에 실패했습니다.');
    }
  };

  const handleJournalSubmit = async (journal: InvestmentJournal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const memoEntries = normalizeMemoEntries(journal.memo);
      const journalData = {
        user_id: user.id,
        date: journal.date,
        total_assets: Math.floor(journal.totalAssets || 0),
        evaluation: Math.floor(journal.evaluation || 0),
        foreign_stocks: journal.foreignStocks || [],
        domestic_stocks: journal.domesticStocks || [],
        cash: journal.cash || { krw: 0, usd: 0 },
        cryptocurrency: journal.cryptocurrency || [],
        trades: journal.trades || '',
        psychology_check: journal.psychologyCheck || {},
        bull_market_checklist: journal.bullMarketChecklist || [],
        bear_market_checklist: journal.bearMarketChecklist || [],
        market_issues: journal.marketIssues || '',
        memo: memoEntries,
        plan_text: journal.planText || '',
        execution_text: journal.executionText || '',
        deviation_reason: journal.deviationReason || '',
        plan_status: journal.planStatus || 'planned',
        exchange_rate: journal.exchangeRate ?? null,
        has_important_memo: hasImportantMemo(memoEntries),
        important_tag: getImportantMemoTag(memoEntries) || null,
        is_public: false,
        updated_at: new Date().toISOString()
      };

      if (selectedJournal?.id) {
        const { error } = await supabase
          .from('investment_journals')
          .update(journalData)
          .eq('id', selectedJournal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('investment_journals')
          .insert(journalData);
        if (error) throw error;
      }

      await loadJournals();
      setCurrentView('list');
      setSelectedJournal(null);
      alert('일지가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('❌ 일지 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handlePublicJournalView = (result: PublicJournalSearchResult) => {
    setPublicJournalResult(result);
    setCurrentView('publicDetail');
  };

  const handleUserChartView = (userProfile: any) => {
    setSelectedUserProfile(userProfile);
    setCurrentView('userChart');
  };

  const handleUserChartJournalClick = (journal: InvestmentJournal) => {
    setSelectedJournal(journal);
    setCurrentView('detail');
  };

  const handleGoToPublicSearch = () => {
    setCurrentView('publicSearch');
    setMobileMenuOpen(false);
  };

  const handleClosePublicSearch = () => {
    setCurrentView('list');
    setPublicJournalResult(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric', weekday: 'short' });
  };

  const latestJournal = journals[0] || null;

  useEffect(() => {
    const stance = deriveStance(latestJournal, exchangeRate);
    setStanceCard(stance);

    const alerts: string[] = [];
    const fg = latestJournal?.psychologyCheck?.fearGreedIndex;
    if (fg !== undefined) {
      if (fg >= 75) alerts.push('시장 탐욕 구간: 포지션 축소/현금 비중 확인');
      if (fg <= 25) alerts.push('극공포: 분할 매수 기회, 손절선 점검');
    }
    const vix = latestJournal?.psychologyCheck?.vixIndex ? Number(latestJournal.psychologyCheck.vixIndex) : null;
    if (vix && vix > 20) alerts.push(`VIX ${vix.toFixed(1)}: 변동성↑, 진입시 분할/스탑 타이트`);
    const dxy = latestJournal?.psychologyCheck?.dxyIndex ? Number(latestJournal.psychologyCheck.dxyIndex) : null;
    if (dxy && dxy > 105) alerts.push(`DXY ${dxy.toFixed(1)}: 달러 강세, 위험자산 압박 주의`);

    // 이벤트 캘린더 알림 (향후 14일 이내)
    const today = new Date();
    const soonEvents = macroEvents.filter((ev) => {
      const evDate = new Date(ev.date);
      const diff = (evDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 14;
    });
    soonEvents.forEach((ev) => {
      alerts.push(`${ev.name} D-${Math.max(0, Math.ceil((new Date(ev.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))}: 변동성 주의`);
    });

    setCoreAlerts(alerts);
  }, [latestJournal, exchangeRate]);

  const buildRecentJournalsSummary = (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const selected = journals.filter((j) => new Date(j.date) >= cutoff);
    if (!selected.length) return '최근 기간에 일지가 없습니다.';
    return selected
      .slice(0, 15)
      .map((j) => {
        const memoText = getMemoText(j.memo);
        return `- 날짜 ${j.date}, 총자산 ${j.totalAssets}, F&G ${j.psychologyCheck?.fearGreedIndex ?? '-'}, 메모 ${memoText || '없음'}`;
      })
      .join('\n');
  };

  const recentJournalsSummary = useMemo(() => buildRecentJournalsSummary(30), [journals]);
  const latestAssetDetails = useMemo(
    () => buildAssetPromptDetails(latestJournal, exchangeRate),
    [latestJournal, exchangeRate]
  );

  const fetchAiCache = async (cacheKey: string | null, cacheType: AiCacheType) => {
    if (!cacheKey || !user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('journal_ai_cache')
        .select('content')
        .eq('user_id', user.id)
        .eq('cache_key', cacheKey)
        .eq('cache_type', cacheType)
        .maybeSingle();

      if (error) {
        console.error('❌ AI 캐시 로드 실패:', error);
        return null;
      }

      return data?.content ?? null;
    } catch (error) {
      console.error('❌ AI 캐시 로드 실패:', error);
      return null;
    }
  };

  const saveAiCache = async (
    cacheKey: string | null,
    cacheType: AiCacheType,
    sourceHash: string,
    content: string
  ) => {
    if (!cacheKey || !user?.id) return;
    try {
      const payload = {
        user_id: user.id,
        cache_key: cacheKey,
        cache_type: cacheType,
        source_hash: sourceHash,
        content,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('journal_ai_cache')
        .upsert(payload, { onConflict: 'user_id,cache_key' });

      if (error) {
        console.error('❌ AI 캐시 저장 실패:', error);
      }
    } catch (error) {
      console.error('❌ AI 캐시 저장 실패:', error);
    }
  };

  const summaryCacheKey = useMemo(() => {
    if (!user?.id || !latestJournal) return null;
    const memoText = getMemoText(latestJournal.memo);
    const payload = JSON.stringify({
      id: latestJournal.id,
      date: latestJournal.date,
      totalAssets: latestJournal.totalAssets,
      psychology: latestJournal.psychologyCheck ?? {},
      memo: memoText || '',
      stance: stanceCard?.stance || '',
      assets: latestAssetDetails
    });
    return `j2w_ai_summary_${user.id}_${hashString(payload)}`;
  }, [user?.id, latestJournal, stanceCard?.stance, latestAssetDetails]);

  const summarySourceHash = useMemo(() => {
    if (!latestJournal) return '';
    const memoText = getMemoText(latestJournal.memo);
    const payload = JSON.stringify({
      id: latestJournal.id,
      date: latestJournal.date,
      totalAssets: latestJournal.totalAssets,
      psychology: latestJournal.psychologyCheck ?? {},
      memo: memoText || '',
      stance: stanceCard?.stance || '',
      assets: latestAssetDetails
    });
    return hashString(payload);
  }, [latestJournal, stanceCard?.stance, latestAssetDetails]);

  const reflectionCacheKey = useMemo(() => {
    if (!user?.id || journals.length === 0) return null;
    const payload = `${recentJournalsSummary}|${stanceCard?.stance || ''}|${latestAssetDetails}`;
    return `j2w_ai_reflection_${user.id}_${hashString(payload)}`;
  }, [user?.id, journals.length, recentJournalsSummary, stanceCard?.stance, latestAssetDetails]);

  const reflectionSourceHash = useMemo(() => {
    const payload = `${recentJournalsSummary}|${stanceCard?.stance || ''}|${latestAssetDetails}`;
    return hashString(payload);
  }, [recentJournalsSummary, stanceCard?.stance, latestAssetDetails]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!summaryCacheKey) {
        setSummaryText('');
        return;
      }
      const cached = readCachedText(summaryCacheKey);
      if (cached) {
        setSummaryText(cached);
        return;
      }
      const remoteCached = await fetchAiCache(summaryCacheKey, 'summary');
      if (!active) return;
      if (remoteCached) {
        setSummaryText(remoteCached);
        writeCachedText(summaryCacheKey, remoteCached);
      } else {
        setSummaryText('');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [summaryCacheKey]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!reflectionCacheKey) {
        setReflectionText('');
        return;
      }
      const cached = readCachedText(reflectionCacheKey);
      if (cached) {
        setReflectionText(cached);
        return;
      }
      const remoteCached = await fetchAiCache(reflectionCacheKey, 'reflection');
      if (!active) return;
      if (remoteCached) {
        setReflectionText(remoteCached);
        writeCachedText(reflectionCacheKey, remoteCached);
      } else {
        setReflectionText('');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [reflectionCacheKey]);

  const stanceAndReflectionCards = (
    <>
      {stanceCard && (
        <Card className="bg-slate-950/40 border-white/10">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-slate-400">스탠스</div>
              <div className="text-xl font-bold text-slate-100">
                {stanceCard.stance}
              </div>
              <div className="text-sm text-slate-300 mt-1">{stanceCard.desc}</div>
            </div>
            {coreAlerts.length > 0 && (
              <div className="space-y-1 text-sm text-slate-200">
                {coreAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-500/40 text-amber-400">알림</Badge>
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-950/40 border-white/10">
        <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm text-slate-400">GPT 요약 (4줄)</div>
              <div className="text-lg font-semibold text-slate-100">핵심 전략 · 위험 · 심리</div>
            </div>
            <Button
              type="button"
              onClick={async () => {
                if (!latestJournal) return;
                const cached = readCachedText(summaryCacheKey);
                if (cached) {
                  setSummaryText(cached);
                  return;
                }
                if (summaryCacheKey) {
                  const remoteCached = await fetchAiCache(summaryCacheKey, 'summary');
                  if (remoteCached) {
                    setSummaryText(remoteCached);
                    writeCachedText(summaryCacheKey, remoteCached);
                    return;
                  }
                }
                setSummaryLoading(true);
                try {
                  const memoText = getMemoText(latestJournal.memo);
                  const stance = stanceCard?.stance || '중립';
                  const messages = [
                    {
                      role: 'system' as const,
                      content:
                        '너는 투자 일지 요약 봇이다. 아래 형식으로만 한국어 4줄로 답해라.\n[전략] 한 줄\n[위험] 한 줄\n[심리] 대중 심리와 내 심리를 분리해 한 줄\n[개선] 실행 가능한 개선 1줄\n입력에 없는 정보는 추정하지 말고 "데이터 없음"으로 표시하라.'
                    },
                    {
                      role: 'user' as const,
                      content: `최근 일지: 날짜 ${latestJournal.date}, 총자산 ${latestJournal.totalAssets}, Fear&Greed ${latestJournal.psychologyCheck?.fearGreedIndex ?? '-'}, VIX ${latestJournal.psychologyCheck?.vixIndex ?? '-'}, DXY ${latestJournal.psychologyCheck?.dxyIndex ?? '-'}, 10Y ${latestJournal.psychologyCheck?.us10yYield ?? '-'}, 스탠스 ${stance}, 메모 ${memoText || '없음'}\n자산 상세:\n${latestAssetDetails}`
                    }
                  ];
                  const res = await callOpenAiProxy(messages, {
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    max_tokens: 220
                  });
                  const content = res?.choices?.[0]?.message?.content || '요약을 생성하지 못했습니다.';
                  setSummaryText(content);
                  writeCachedText(summaryCacheKey, content);
                  await saveAiCache(summaryCacheKey, 'summary', summarySourceHash, content);
                } catch (error) {
                  console.error('요약 생성 실패:', error);
                  setSummaryText('요약 생성 실패. 잠시 후 다시 시도해주세요.');
                } finally {
                  setSummaryLoading(false);
                }
              }}
              disabled={!latestJournal || summaryLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {summaryLoading ? '생성 중...' : '요약 생성'}
            </Button>
          </div>
          <div className="text-sm text-slate-300 whitespace-pre-wrap min-h-[60px]">
            {summaryText || '버튼을 눌러 최신 일지 기반 요약을 생성하세요.'}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40 border-white/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm text-slate-400">월간 리플렉션 (최근 30일)</div>
              <div className="text-lg font-semibold text-slate-100">착오 TOP3 / 개선 포인트</div>
            </div>
            <Button
              type="button"
              onClick={async () => {
                const cached = readCachedText(reflectionCacheKey);
                if (cached) {
                  setReflectionText(cached);
                  return;
                }
                if (reflectionCacheKey) {
                  const remoteCached = await fetchAiCache(reflectionCacheKey, 'reflection');
                  if (remoteCached) {
                    setReflectionText(remoteCached);
                    writeCachedText(reflectionCacheKey, remoteCached);
                    return;
                  }
                }
                setReflectionLoading(true);
                try {
                  const stance = stanceCard?.stance || '중립';
                  const messages = [
                    {
                      role: 'system' as const,
                      content:
                        '너는 투자 리플렉션 코치다. 아래 형식으로만 한국어로 답하라.\n착오 Top3:\n- 항목 1\n- 항목 2\n- 항목 3\n심리/과몰입 점검:\n- 한 줄\n다음 달 액션 3가지:\n- 액션 1\n- 액션 2\n- 액션 3\n입력에 없는 정보는 추정하지 말고 "데이터 없음"으로 표시하라.'
                    },
                    {
                      role: 'user' as const,
                      content: `최근 30일 일지 요약:\n${recentJournalsSummary}\n현재 스탠스: ${stance}\n최근 일지 자산 상세:\n${latestAssetDetails}`
                    }
                  ];
                  const res = await callOpenAiProxy(messages, {
                    model: 'gpt-4o',
                    temperature: 0.2,
                    max_tokens: 360
                  });
                  const content = res?.choices?.[0]?.message?.content || '리플렉션을 생성하지 못했습니다.';
                  setReflectionText(content);
                  writeCachedText(reflectionCacheKey, content);
                  await saveAiCache(reflectionCacheKey, 'reflection', reflectionSourceHash, content);
                } catch (error) {
                  console.error('리플렉션 생성 실패:', error);
                  setReflectionText('리플렉션 생성 실패. 잠시 후 다시 시도해주세요.');
                } finally {
                  setReflectionLoading(false);
                }
              }}
              disabled={reflectionLoading || journals.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {reflectionLoading ? '생성 중...' : '리플렉션 생성'}
            </Button>
          </div>
          <div className="text-sm text-slate-300 whitespace-pre-wrap min-h-[80px]">
            {reflectionText || '최근 30일 일지를 바탕으로 월간 리플렉션을 생성합니다.'}
          </div>
        </CardContent>
      </Card>
    </>
  );

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center glass-panel px-8 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-300 mx-auto mb-4" />
            <p className="text-slate-200/80">로딩 중...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (currentView === 'publicSearch') {
    return (
      <PageShell>
        <div className="min-h-screen">
          <PublicJournalSearch
            onJournalSelect={handlePublicJournalView}
            onClose={handleClosePublicSearch}
            onUserChartView={handleUserChartView}
          />
        </div>
      </PageShell>
    );
  }

  if (currentView === 'publicDetail' && publicJournalResult) {
    return (
      <PageShell>
        <div className="min-h-screen">
          <PublicJournalDetail
            result={publicJournalResult}
            onBack={handleClosePublicSearch}
            exchangeRate={exchangeRate}
          />
        </div>
      </PageShell>
    );
  }

  if (currentView === 'userChart' && selectedUserProfile) {
    return (
      <PageShell>
        <div className="container mx-auto p-2 sm:p-4">
          <UserAssetChart
            userProfile={selectedUserProfile}
            onJournalClick={handleUserChartJournalClick}
            onBack={() => setCurrentView('publicSearch')}
          />
        </div>
      </PageShell>
    );
  }

  if (currentView === 'detail' && selectedJournal) {
    const isPublicDetail = Boolean(selectedUserProfile);
    const backTarget = isPublicDetail ? 'userChart' : user ? 'list' : 'publicSearch';
    return (
      <PageShell>
        <JournalDetail
          journal={selectedJournal}
          onBack={() => {
            setCurrentView(backTarget);
            setSelectedJournal(null);
          }}
          onEdit={() => setCurrentView('form')}
          onDelete={handleJournalDelete}
          onMemoDelete={handleMemoDelete}
          exchangeRate={exchangeRate}
          hideAssetAmounts={isPublicDetail ? selectedUserProfile?.hide_asset_amounts : false}
        />
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md mx-auto text-center space-y-8 glass-panel px-8 py-10">
            <div className="space-y-4">
              <div className="inline-block p-4 rounded-full bg-blue-500/10 mb-4">
                <TrendingUp className="w-12 h-12 text-blue-500" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 bg-clip-text text-transparent">
                빛의경제 투자 매매일지
              </h1>
              <p className="text-slate-200/70 text-lg">
                성공적인 투자를 위한 체계적인 기록과 분석
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={signInWithGoogle}
                className="w-full bg-white/90 text-slate-900 hover:bg-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all flex items-center justify-center gap-3 shadow-lg shadow-white/10"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google로 시작하기
              </button>
              
              <button
                onClick={handleGoToPublicSearch}
                className="w-full bg-slate-900/70 hover:bg-slate-800/80 text-slate-200 px-8 py-3.5 rounded-xl text-lg font-medium transition-all flex items-center justify-center gap-3 border border-white/10 backdrop-blur"
              >
                <Search className="w-5 h-5" />
                다른 사용자 일지 검색
              </button>
            </div>
            
            <p className="text-sm text-slate-300/70 pt-4">
              로그인하면 포트폴리오 분석, 자산 추적 등<br/>모든 프리미엄 기능을 무료로 이용할 수 있습니다.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (currentView === 'profile') {
    return (
      <PageShell>
        <UserProfile onClose={() => setCurrentView('list')} />
      </PageShell>
    );
  }

  if (currentView === 'form') {
    return (
      <PageShell>
        <JournalForm
          key={selectedJournal ? selectedJournal.id : 'new'} // 🔥 키를 추가하여 컴포넌트 재생성 강제
          onSubmit={handleJournalSubmit}
          initialData={selectedJournal}
          onCancel={() => {
            setCurrentView('list');
            setSelectedJournal(null);
          }}
        />
      </PageShell>
    );
  }

  if (currentView === 'memoList') {
    return (
      <PageShell>
        <MemoList
          journals={journals}
          onBack={() => setCurrentView('list')}
          onJournalClick={handleJournalClick}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      header={(
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('list')}>
            <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-1.5 rounded-lg shadow-lg shadow-cyan-500/30">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-base sm:text-xl font-bold font-display text-slate-100 sm:bg-gradient-to-r sm:from-white sm:to-slate-300 sm:bg-clip-text sm:text-transparent truncate max-w-[140px] sm:max-w-none whitespace-nowrap">
              빛의경제 투자 매매일지
            </h1>
          </div>
          
          {/* 📱 모바일: 햄버거 메뉴 */}
          <div className="sm:hidden">
            <Button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>

          {/* 🖥️ 데스크톱 네비게이션 */}
          <div className="hidden sm:flex items-center gap-3">
            <Button
              onClick={handleGoToPublicSearch}
              variant="ghost"
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <Search className="h-4 w-4 mr-2" />
              사용자 검색
            </Button>
            
            <Button
              onClick={() => setCurrentView('profile')}
              variant="ghost"
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <Settings className="h-4 w-4 mr-2" />
              설정
            </Button>
            
            <div className="h-6 w-px bg-white/10 mx-2" />
            
            <div className="flex items-center gap-3 mr-4">
              {userProfile?.nickname && (
                <Badge variant="outline" className="border-cyan-300/40 text-cyan-200 bg-cyan-500/10">
                  {userProfile.nickname}
                </Badge>
              )}
              <span className="text-sm text-slate-200/70 hidden lg:inline">
                {user.user_metadata?.full_name || user.email}
              </span>
            </div>
            
            <Button
              onClick={signOut}
              variant="ghost"
              size="sm"
              className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => {
                setSelectedJournal(null);
                setCurrentView('form');
              }}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 ml-2"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              새 일지 작성
            </Button>
          </div>
        </div>

        {/* 📱 모바일 메뉴 드롭다운 */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-slate-950/80 absolute w-full left-0 p-4 shadow-2xl animate-in slide-in-from-top-5 backdrop-blur-xl">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-sm text-slate-200/70">{user.email}</span>
                {userProfile?.nickname && (
                  <Badge variant="outline" className="border-cyan-300/40 text-cyan-200 bg-cyan-500/10">
                    {userProfile.nickname}
                  </Badge>
                )}
              </div>
              
              <Button
                onClick={() => {
                  setSelectedJournal(null);
                  setCurrentView('form');
                  setMobileMenuOpen(false);
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 w-full justify-start"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                새 일지 작성
              </Button>
              
              <Button
                onClick={handleGoToPublicSearch}
                variant="ghost"
                className="w-full justify-start text-slate-200 hover:bg-white/10"
              >
                <Search className="h-4 w-4 mr-2" />
                사용자 검색
              </Button>
              
              <Button
                onClick={() => {
                  setCurrentView('profile');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full justify-start text-slate-200 hover:bg-white/10"
              >
                <Settings className="h-4 w-4 mr-2" />
                프로필 설정
              </Button>
              
              <div className="h-px bg-white/10 my-2" />
              
              <Button 
                onClick={signOut}
                variant="ghost"
                className="w-full justify-start text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        )}
      </header>
      )}
    >
      
      <main className="container mx-auto px-3 sm:px-6 py-10 space-y-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-6 lg:items-start">
          <DashboardTodoList userId={user?.id} />
          <div className="glass-panel bg-slate-950/40 px-4 py-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Quick Lens</div>
            <div className="text-lg font-semibold text-slate-100">오늘의 신호</div>
            <p className="text-sm text-slate-200/70">
              리스크 스냅샷과 GPT 요약을 빠르게 확인하고, 필요하면 바로 깊게 펼쳐보세요.
            </p>
          </div>
        </div>

        {/* 리스크 스냅샷 */}
        <RiskSnapshot journal={latestJournal} exchangeRate={exchangeRate} extraContent={stanceAndReflectionCards} />

        {/* 자산 차트 */}
        <AssetChangeChart 
          onPointClick={handleChartPointClick} 
          onViewMemos={() => setCurrentView('memoList')}
        />

        {/* 시나리오 트래커 */}
        <ScenarioTracker />

        {/* 최근 투자일지 목록 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
            <Calendar className="h-5 w-5 text-cyan-300" />
            최근 투자일지
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/10 text-slate-200/70 border border-white/10">
              총 {journals.length}개
            </Badge>
          </div>
        </div>

          {journals.length === 0 ? (
            <Card className="border-white/15 border-dashed bg-white/5">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PlusCircle className="h-8 w-8 text-slate-300/70" />
                </div>
                <p className="text-slate-200/70 mb-2">아직 작성된 일지가 없습니다.</p>
                <Button 
                  onClick={() => {
                    setSelectedJournal(null);
                    setCurrentView('form');
                  }}
                  variant="link" 
                  className="text-blue-400"
                >
                  첫 번째 투자일지 작성하기
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <div className="space-y-3">
                {journals.map((journal) => (
                  <div 
                    key={journal.id}
                    onClick={() => handleJournalClick(journal)}
                    className="group bg-white/5 border border-white/10 hover:border-cyan-300/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5 relative overflow-hidden backdrop-blur-xl"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-100 font-mono">
                            {formatDate(journal.date)}
                          </span>
                          {journal.psychologyCheck && (
                            <Badge variant="outline" className={`text-xs ${
                              journal.psychologyCheck.fearGreedIndex > 75 ? 'border-red-500/50 text-red-400' :
                              journal.psychologyCheck.fearGreedIndex < 25 ? 'border-blue-500/50 text-blue-400' :
                              'border-yellow-400/50 text-yellow-300'
                            }`}>
                              F&G: {journal.psychologyCheck.fearGreedIndex}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-200/70">
                          <span className="font-medium text-slate-200/70">총 자산:</span>
                          <span className="font-mono text-slate-100">{formatKoreanCurrency(journal.totalAssets || 0)}</span>
                        </div>

                        {(getMemoText(journal.memo) || journal.marketIssues) && (
                          <p className="text-sm text-slate-200/60 line-clamp-1">
                            {getMemoText(journal.memo) || journal.marketIssues}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 mt-2 sm:mt-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-none text-slate-200/70 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          보기
                        </Button>
                        <div className="w-px h-4 bg-white/10 hidden sm:block" />
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJournal(journal);
                            setCurrentView('form');
                          }}
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-none text-slate-200/70 hover:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          수정
                        </Button>
                        <div className="w-px h-4 bg-white/10 hidden sm:block" />
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('정말로 이 일지를 삭제하시겠습니까?')) {
                              handleJournalDelete(journal.id);
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-none text-slate-200/70 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </main>
    </PageShell>
  );
}

export default Index;
