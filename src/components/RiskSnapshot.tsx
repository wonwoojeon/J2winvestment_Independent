import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, PieChart, Brain, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { InvestmentJournal } from '@/types/investment';
import { formatKoreanCurrency } from '@/utils/formatters';
import { getJournalExchangeRate } from '@/utils/exchangeRate';

interface RiskSnapshotProps {
  journal?: InvestmentJournal | null;
  exchangeRate: number;
  hideAssetAmounts?: boolean;
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getFearGreedLabel = (value: number) => {
  if (value >= 75) return { text: '극탐욕', color: 'text-rose-400' };
  if (value >= 55) return { text: '탐욕', color: 'text-orange-400' };
  if (value >= 45) return { text: '중립', color: 'text-yellow-400' };
  if (value >= 25) return { text: '공포', color: 'text-blue-400' };
  return { text: '극공포', color: 'text-purple-400' };
};

export const RiskSnapshot: React.FC<RiskSnapshotProps> = ({ journal, exchangeRate, hideAssetAmounts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!journal) {
    return (
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            리스크 스냅샷
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          최근 일지를 작성하면 리스크 스냅샷이 표시됩니다.
        </CardContent>
      </Card>
    );
  }

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
  const cashRatio = totalAssets > 0 ? (cashTotal / totalAssets) * 100 : 0;

  const buckets = [
    { label: '해외주식', value: foreignTotal },
    { label: '국내주식', value: domesticTotal },
    { label: '크립토', value: cryptoTotal },
    { label: '현금', value: cashTotal }
  ];
  const topBucket = buckets.reduce((max, item) => (item.value > max.value ? item : max), buckets[0]);
  const concentration = totalAssets > 0 ? (topBucket.value / totalAssets) * 100 : 0;

  const fearGreedValue = journal.psychologyCheck?.fearGreedIndex ?? 50;
  const fearGreedLabel = getFearGreedLabel(fearGreedValue);

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl">
      <CardHeader className="pb-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            리스크 스냅샷
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                접기
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                펼치기
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Wallet className="h-4 w-4 text-emerald-400" />
              보유 현금
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {hideAssetAmounts ? '비공개' : formatKoreanCurrency(cashTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              현금 비중 {formatPercent(cashRatio)}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <PieChart className="h-4 w-4 text-amber-400" />
              편중도
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {formatPercent(concentration)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {topBucket.label}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Brain className="h-4 w-4 text-blue-400" />
              Fear &amp; Greed
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {fearGreedValue}
            </div>
            <Badge variant="outline" className={`mt-2 text-xs ${fearGreedLabel.color}`}>
              {fearGreedLabel.text}
            </Badge>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Layers className="h-4 w-4 text-purple-400" />
              총 자산
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {hideAssetAmounts ? '비공개' : formatKoreanCurrency(totalAssets)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              최신 일지 기준
            </div>
          </div>
        </div>
        </CardContent>
      )}
    </Card>
  );
};
