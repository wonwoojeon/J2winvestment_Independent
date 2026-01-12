import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hideAssetAmounts = Boolean(userProfile?.hide_asset_amounts);

  useEffect(() => {
    if (userProfile?.user_id) {
      loadLatestJournal();
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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto p-2 sm:p-4 max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            돌아가기
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <User className="h-4 w-4 text-blue-400" />
            <span className="font-medium">{userProfile?.nickname || '공개 사용자'}</span>
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
      </div>
    </div>
  );
};
