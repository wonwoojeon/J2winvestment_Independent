import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardTodoList } from '@/components/DashboardTodoList';
import { ArrowLeft, User, Calendar, Eye } from 'lucide-react';
import { InvestmentJournal } from '@/types/investment';
import { supabase } from '@/lib/supabase';
import AssetChangeChart from './AssetChangeChart';
import { RiskSnapshot } from './RiskSnapshot';
import { ScenarioTracker } from './ScenarioTracker';

interface UserAssetChartProps {
  userProfile: any;
  onJournalClick: (journal: InvestmentJournal) => void;
  onBack: () => void;
}

const mapJournal = (item: any): InvestmentJournal => ({
  id: item.id,
  user_id: item.user_id,
  date: item.date,
  totalAssets: item.total_assets || 0,
  evaluation: item.evaluation || 0,
  exchangeRate: item.exchange_rate ? Number(item.exchange_rate) : undefined,
  foreignStocks: item.foreign_stocks || [],
  domesticStocks: item.domestic_stocks || [],
  cash: item.cash || { krw: 0, usd: 0 },
  cryptocurrency: item.cryptocurrency || [],
  trades: item.trades || '',
  psychologyCheck: item.psychology_check || { fearGreedIndex: 50 },
  bullMarketChecklist: item.bull_market_checklist || [],
  bearMarketChecklist: item.bear_market_checklist || [],
  marketIssues: item.market_issues || '',
  memo: item.memo ?? '',
  planText: item.plan_text || '',
  executionText: item.execution_text || '',
  deviationReason: item.deviation_reason || '',
  planStatus: item.plan_status || 'planned'
});

export const UserAssetChart: React.FC<UserAssetChartProps> = ({
  userProfile,
  onJournalClick,
  onBack
}) => {
  const [latestJournal, setLatestJournal] = useState<InvestmentJournal | null>(null);
  const [journals, setJournals] = useState<InvestmentJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJournals, setLoadingJournals] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hideAssetAmounts = Boolean(userProfile?.hide_asset_amounts);

  useEffect(() => {
    if (userProfile?.user_id) {
      loadLatestJournal();
      loadJournals();
    }
  }, [userProfile?.user_id]);

  const loadLatestJournal = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('investment_journals')
        .select('*')
        .eq('user_id', userProfile.user_id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setLatestJournal(data ? mapJournal(data) : null);
    } catch (err) {
      console.error('❌ 최신 일지 로드 실패:', err);
      setError('일지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadJournals = async () => {
    if (!userProfile?.user_id) return;
    try {
      setLoadingJournals(true);
      const { data, error } = await supabase
        .from('investment_journals')
        .select('*')
        .eq('user_id', userProfile.user_id)
        .order('date', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((item) => mapJournal(item));
      setJournals(mapped);
    } catch (err) {
      console.error('❌ 공개 사용자 일지 목록 로드 실패:', err);
      setJournals([]);
    } finally {
      setLoadingJournals(false);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ko-KR');
  const formatCurrency = (value: number) => (hideAssetAmounts ? '비공개' : `${Math.floor(value).toLocaleString()}원`);
  const shortUserId = userProfile?.user_id ? `${String(userProfile.user_id).slice(0, 8)}...` : 'N/A';

  const handlePointClick = async (date: string) => {
    if (!userProfile?.user_id) return;
    try {
      setLoadingDetail(true);
      const { data, error } = await supabase
        .from('investment_journals')
        .select('*')
        .eq('user_id', userProfile.user_id)
        .eq('date', date)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        onJournalClick(mapJournal(data));
      } else {
        alert('해당 날짜의 일지를 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ 공개 일지 상세 로드 실패:', err);
      alert('일지 불러오기에 실패했습니다.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 space-y-4 sm:space-y-6">
        <div className="glass-panel bg-slate-950/45 px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl border border-slate-700 bg-slate-900/90 text-slate-100 hover:bg-slate-800 hover:text-white w-fit px-3 shadow-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <User className="h-4 w-4 text-cyan-300" />
                <span className="font-semibold">{userProfile?.nickname || '공개 사용자'}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300/70">
                공개 계정의 투두, 리스크 스냅샷, 최근 일지를 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="border-cyan-300/40 text-cyan-200 bg-cyan-500/10">
                @{userProfile?.nickname || 'public'}
              </Badge>
              <span className="text-[11px] sm:text-xs text-slate-400">ID {shortUserId}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-4 sm:gap-6 lg:items-start">
          <DashboardTodoList userId={userProfile?.user_id} readOnly />
          <div className="glass-panel bg-slate-950/40 px-4 py-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Public Profile</div>
            <div className="text-lg font-semibold text-slate-100">
              {userProfile?.nickname || '공개 사용자'}
            </div>
            <div className="space-y-2 text-sm text-slate-300/80">
              <div className="flex items-center justify-between">
                <span>일지 수</span>
                <span className="font-medium text-slate-100">{journals.length}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span>최근 자산</span>
                <span className="font-medium text-slate-100">
                  {formatCurrency((latestJournal?.totalAssets || userProfile?.latest_assets || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 text-sm text-rose-400">{error}</CardContent>
          </Card>
        )}

        {!loading && latestJournal && (
          <RiskSnapshot
            journal={latestJournal}
            exchangeRate={1300}
            hideAssetAmounts={hideAssetAmounts}
          />
        )}

        <AssetChangeChart
          userId={userProfile?.user_id}
          hideAssetAmounts={hideAssetAmounts}
          onPointClick={handlePointClick}
        />

        <ScenarioTracker userId={userProfile?.user_id} readOnly />

        {loadingDetail && (
          <div className="text-xs text-slate-500 text-center">상세 일지를 불러오는 중...</div>
        )}

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
              <Calendar className="h-5 w-5 text-cyan-300" />
              최근 투자일지
            </h2>
            <Badge variant="secondary" className="bg-white/10 text-slate-200/70 border border-white/10">
              총 {journals.length}개
            </Badge>
          </div>

          {loadingJournals ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-8 text-center text-sm text-slate-400">일지 불러오는 중...</CardContent>
            </Card>
          ) : journals.length === 0 ? (
            <Card className="border-white/15 border-dashed bg-white/5">
              <CardContent className="py-10 text-center text-sm text-slate-300/70">공개된 일지가 없습니다.</CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[420px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <div className="space-y-3">
                {journals.map((journal) => (
                  <div
                    key={journal.id}
                    onClick={() => onJournalClick(journal)}
                    className="group bg-white/5 border border-white/10 hover:border-cyan-300/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5 relative overflow-hidden backdrop-blur-xl"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex flex-col sm:flex-row gap-3 justify-between">
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
                        <div className="text-sm text-slate-300">
                          총자산: {formatCurrency(journal.totalAssets || 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-200/70 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          보기
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};
