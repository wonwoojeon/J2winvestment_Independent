import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { fetchSP500Data, SP500Data, checkAPIUsage } from '@/lib/alphaVantage';
import { TrendingUp, TrendingDown, Activity, RefreshCw, BarChart3, Eye, EyeOff, Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MemoEntry } from '@/types/investment';
import { getImportantMemoTag, getMemoText, hasImportantMemo, normalizeMemoEntries } from '@/utils/memo';

// 통화 포맷팅 함수
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

interface ChartData {
  date: string;
  assets: number;
  assetPercentage: number;
  sp500Percentage: number;
  sp500Price?: number; // 원본 S&P 500 가격 저장
  memo?: MemoEntry[] | string | null;
  marketIssues?: string;
  hasImportantMemo?: boolean;
  importantTag?: string | null;
}

interface AssetChangeChartProps {
  onPointClick?: (date: string) => void;
  onViewMemos?: () => void;
}

// 커스텀 닷 컴포넌트: 메모나 이슈가 있는 날은 빨간 점으로 표시
const CustomizedDot = (props: any) => {
  const { cx, cy, payload } = props;
  const memoEntries = normalizeMemoEntries(payload.memo);
  const hasMemo = memoEntries.length > 0 || Boolean(payload.marketIssues);

  if (hasMemo) {
    const isImportant =
      payload.hasImportantMemo || payload.importantTag || hasImportantMemo(payload.memo);
    const fillColor = isImportant ? '#facc15' : '#ef4444';
    const strokeColor = isImportant ? '#fde047' : 'white';
    return (
      <circle cx={cx} cy={cy} r={6} stroke={strokeColor} strokeWidth={2} fill={fillColor} />
    );
  }
  
  // 일반 데이터 포인트는 표시하지 않음
  return null;
};

const AssetChangeChart: React.FC<AssetChangeChartProps> = ({ onPointClick, onViewMemos }) => {
  const [rawData, setRawData] = useState<ChartData[]>([]); // 원본 데이터
  const [loading, setLoading] = useState(true);
  const [sp500Loading, setSp500Loading] = useState(false);
  const [sp500Data, setSp500Data] = useState<SP500Data[]>([]);
  const [showSP500, setShowSP500] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'all' | '1y' | '3y'>('all');
  const isMobile = useIsMobile();
  const [activeTooltip, setActiveTooltip] = useState<ChartData | null>(null);
  const [activeTooltipLabel, setActiveTooltipLabel] = useState<string>('');

  useEffect(() => {
    loadChartData();
  }, []);

  // 기간 필터링 및 수익률 재계산
  const displayData = useMemo(() => {
    if (rawData.length === 0) return [];

    let filtered = [...rawData];

    // 1. 기간 필터링
    if (timeRange === '1y') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const dateStr = oneYearAgo.toISOString().split('T')[0];
      filtered = filtered.filter(item => item.date >= dateStr);
    } else if (timeRange === '3y') {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const dateStr = threeYearsAgo.toISOString().split('T')[0];
      filtered = filtered.filter(item => item.date >= dateStr);
    }

    if (filtered.length === 0) return [];

    // 2. 수익률 재계산 (필터링된 기간의 첫 데이터를 기준 0%로 설정)
    const baseAssets = filtered[0].assets;
    const baseSP500 = filtered[0].sp500Price || 0;

    return filtered.map(item => {
      // 내 자산 수익률 재계산
      const assetPercentage = baseAssets > 0 
        ? ((item.assets - baseAssets) / baseAssets) * 100 
        : 0;

      // S&P 500 수익률 재계산 (데이터가 있는 경우)
      let sp500Percentage = 0;
      if (baseSP500 > 0 && item.sp500Price) {
        sp500Percentage = ((item.sp500Price - baseSP500) / baseSP500) * 100;
      }

      return {
        ...item,
        assetPercentage: Math.round(assetPercentage * 100) / 100,
        sp500Percentage: Math.round(sp500Percentage * 100) / 100
      };
    });
  }, [rawData, timeRange]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('investment_journals')
        .select('date, total_assets, memo, market_issues, has_important_memo, important_tag')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setRawData([]);
        return;
      }

      // 초기 데이터 구성 (수익률은 나중에 displayData에서 계산)
      const processedData: ChartData[] = data.map((journal) => ({
        date: journal.date,
        assets: journal.total_assets || 0,
        assetPercentage: 0,
        sp500Percentage: 0,
        memo: journal.memo || [],
        marketIssues: journal.market_issues || '',
        hasImportantMemo: journal.has_important_memo ?? false,
        importantTag: journal.important_tag ?? null
      }));

      setRawData(processedData);
    } catch (error) {
      console.error('❌ 차트 데이터 로드 실패:', error);
      setError('차트 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSP500Data = async () => {
    try {
      setSp500Loading(true);
      setError(null);
      
      checkAPIUsage();
      
      // compact는 최근 100개, full은 20년치 데이터
      const sp500RawData = await fetchSP500Data('compact');
      setSp500Data(sp500RawData);

      if (rawData.length > 0) {
        const sortedSP500 = [...sp500RawData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // 각 데이터 포인트에 S&P 500 가격 매핑
        const updatedRawData = rawData.map((item) => {
          // 해당 날짜 또는 가장 가까운 과거 날짜의 S&P 500 데이터 찾기
          const sp500Item = sortedSP500.find(sp => sp.date <= item.date);
          
          // 데이터가 없으면 (너무 과거거나 미래) 가장 가까운 데이터 사용
          const sp500Price = sp500Item ? sp500Item.close : (sortedSP500.length > 0 ? sortedSP500[sortedSP500.length - 1].close : 0);

          return {
            ...item,
            sp500Price
          };
        });

        setRawData(updatedRawData);
        setShowSP500(true);
      }

    } catch (error) {
      console.error('❌ S&P 500 데이터 로드 실패:', error);
      setError('S&P 500 데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSp500Loading(false);
    }
  };

  const handleChartClick = (event: any) => {
    if (event && event.activePayload && event.activePayload.length > 0) {
      const clickedData = event.activePayload[0].payload;
      if (!clickedData || !clickedData.date) return;
      if (isMobile) {
        if (activeTooltip?.date === clickedData.date) {
          setActiveTooltip(null);
          setActiveTooltipLabel('');
          return;
        }
        setActiveTooltip(clickedData);
        setActiveTooltipLabel(clickedData.date);
        return;
      }
      if (onPointClick) {
        onPointClick(clickedData.date);
      }
    } else if (isMobile) {
      setActiveTooltip(null);
      setActiveTooltipLabel('');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const memoText = getMemoText(data.memo);
      const importantTag = data.importantTag || getImportantMemoTag(data.memo);
      return (
        // Restrict the maximum width of the tooltip to prevent it from overflowing
        // the viewport.  Without this constraint long memos could cause the
        // tooltip box to stretch across the page.  Tailwind's `max-w-xs` (20rem)
        // utility keeps the tooltip reasonably sized while still allowing
        // shorter content to expand naturally.  The existing `min-w-[180px]`
        // ensures the box doesn't collapse when the content is very small.
        <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl text-xs z-50 min-w-[180px] max-w-xs">
          <p className="text-slate-300 font-semibold mb-2 border-b border-slate-800 pb-1">{label}</p>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-blue-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                총 자산
              </span>
              <span className="text-white font-mono">{formatKoreanCurrency(data.assets)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                수익률
              </span>
              <span className={`${data.assetPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-mono font-bold`}>
                {data.assetPercentage >= 0 ? '+' : ''}{data.assetPercentage.toFixed(2)}%
              </span>
            </div>
            {showSP500 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-amber-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  S&P 500
                </span>
                <span className={`${data.sp500Percentage >= 0 ? 'text-amber-400' : 'text-orange-400'} font-mono`}>
                  {data.sp500Percentage >= 0 ? '+' : ''}{data.sp500Percentage.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {(memoText || data.marketIssues) && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              {importantTag && (
                <p className="text-amber-300 font-semibold mb-1">#{importantTag}</p>
              )}
              <div className="flex items-start gap-1.5 text-slate-300">
                <span className="text-xs mt-0.5">📝</span>
                <span className="text-slate-400 leading-relaxed max-w-xs whitespace-pre-wrap break-words">
                  {memoText || data.marketIssues}
                </span>
              </div>
            </div>
          )}
          
          <div className="mt-2 text-[10px] text-slate-600 text-center">
            {isMobile ? (
              <button
                type="button"
                onClick={() => onPointClick?.(data.date)}
                className="text-amber-300 hover:text-amber-200 transition-colors"
              >
                탭하여 상세 보기
              </button>
            ) : (
              '클릭하여 상세 보기'
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-slate-400 text-sm animate-pulse">자산 데이터를 분석하고 있습니다...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rawData.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            자산 변화 추이
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-slate-500 py-12 bg-slate-950/50 rounded-lg border border-slate-800/50 border-dashed">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>아직 등록된 투자일지가 없습니다.</p>
            <p className="text-sm mt-1">첫 번째 일지를 작성하여 자산 추적을 시작해보세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestData = displayData[displayData.length - 1];
  const latestAssetPercentage = latestData?.assetPercentage || 0;
  const latestSP500Percentage = latestData?.sp500Percentage || 0;
  const alpha = latestAssetPercentage - latestSP500Percentage;

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl">
      <CardHeader className="pb-4 border-b border-slate-800/50 bg-slate-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-blue-500" />
              자산 포트폴리오 성과
            </CardTitle>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-400 text-sm">
                현재 자산: <span className="text-slate-200 font-semibold">{latestData ? formatKoreanCurrency(latestData.assets) : '0원'}</span>
              </p>
              <div className="h-3 w-px bg-slate-700"></div>
              <Tabs defaultValue="all" value={timeRange} onValueChange={(v) => setTimeRange(v as 'all' | '1y' | '3y')} className="h-6">
                <TabsList className="h-7 bg-slate-800 border border-slate-700 p-0">
                  <TabsTrigger value="all" className="text-xs h-full px-3 data-[state=active]:bg-slate-700 data-[state=active]:text-white">전체</TabsTrigger>
                  <TabsTrigger value="1y" className="text-xs h-full px-3 data-[state=active]:bg-slate-700 data-[state=active]:text-white">1년</TabsTrigger>
                  <TabsTrigger value="3y" className="text-xs h-full px-3 data-[state=active]:bg-slate-700 data-[state=active]:text-white">3년</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onViewMemos && (
              <Button
                onClick={onViewMemos}
                variant="outline"
                size="sm"
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              >
                <Eye className="h-4 w-4 mr-2" />
                전체 메모
              </Button>
            )}
            
            {sp500Data.length === 0 ? (
              <Button
                onClick={loadSP500Data}
                disabled={sp500Loading}
                variant="outline"
                size="sm"
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              >
                {sp500Loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                S&P 500 비교
              </Button>
            ) : (
              <Button
                onClick={() => setShowSP500(!showSP500)}
                variant={showSP500 ? "secondary" : "outline"}
                size="sm"
                className={`transition-all ${showSP500 ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/50' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                {showSP500 ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                S&P 500 {showSP500 ? 'ON' : 'OFF'}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className={`px-2 py-1 ${latestAssetPercentage >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
            {latestAssetPercentage >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            기간 수익률: {latestAssetPercentage >= 0 ? '+' : ''}{latestAssetPercentage.toFixed(2)}%
          </Badge>
          
          {showSP500 && (
            <>
              <Badge variant="outline" className={`px-2 py-1 ${latestSP500Percentage >= 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'}`}>
                <BarChart3 className="h-3 w-3 mr-1" />
                S&P 500: {latestSP500Percentage >= 0 ? '+' : ''}{latestSP500Percentage.toFixed(2)}%
              </Badge>
              <Badge variant="outline" className={`px-2 py-1 ${alpha >= 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                알파(α): {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%p
              </Badge>
            </>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {error && (
          <div className="m-4 p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
            <Info className="h-4 w-4" />
            {error}
          </div>
        )}
        
        <div className="h-[300px] w-full mt-4 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSP500" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(value) => new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(value) => showSP500 ? `${value.toFixed(0)}%` : formatKoreanCurrency(value).replace('원', '')}
                width={50}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                active={isMobile ? Boolean(activeTooltip) : undefined}
                payload={isMobile && activeTooltip ? [{ payload: activeTooltip }] : undefined}
                label={isMobile ? activeTooltipLabel : undefined}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              <Area
                type="monotone"
                dataKey={showSP500 ? "assetPercentage" : "assets"}
                stroke="#3B82F6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAssets)"
                name={showSP500 ? "내 수익률" : "총 자산"}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#60A5FA' }}
                dot={<CustomizedDot />}
              />
              
              {showSP500 && (
                <Area
                  type="monotone"
                  dataKey="sp500Percentage"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorSP500)"
                  name="S&P 500"
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#FBBF24' }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="p-4 text-center border-t border-slate-800/50 bg-slate-950/30">
          <p className="text-xs text-slate-500">
            💡 차트의 포인트를 클릭하면 해당 날짜의 일지로 이동합니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetChangeChart;
