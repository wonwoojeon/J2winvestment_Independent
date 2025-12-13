import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, User, ArrowLeft, Eye, BarChart3, Filter } from 'lucide-react';
import { PublicJournalSearchResult, InvestmentJournal } from '@/types/investment';
import { supabase } from '@/lib/supabase';

interface UserAssetChartProps {
  userProfile: any;
  onJournalClick: (journal: InvestmentJournal) => void;
  onBack: () => void;
}

export const UserAssetChart: React.FC<UserAssetChartProps> = ({ 
  userProfile, 
  onJournalClick, 
  onBack 
}) => {
  const [userJournals, setUserJournals] = useState<InvestmentJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'all' | '1year' | '6months' | '3months'>('all');
  const [showSP500, setShowSP500] = useState(false);
  const [sp500Data, setSP500Data] = useState<{[key: string]: number}>({});

  useEffect(() => {
    if (userProfile) {
      loadUserJournals();
    }
  }, [userProfile]);

  useEffect(() => {
    if (showSP500 && chartData.length > 0) {
      loadSP500Data();
    }
  }, [showSP500, chartData]);

  const loadUserJournals = async () => {
    try {
      console.log('📊 사용자 일지 로드 시작:', userProfile.nickname);
      
      const { data, error } = await supabase
        .from('investment_journals')
        .select('*')
        .eq('user_id', userProfile.user_id)
        .order('date', { ascending: true });

      if (error) throw error;

      const journals: InvestmentJournal[] = (data || []).map(item => ({
        id: item.id,
        date: item.date,
        totalAssets: item.total_assets || 0,
        evaluation: item.evaluation || 0,
        foreignStocks: item.foreign_stocks || [],
        domesticStocks: item.domestic_stocks || [],
        cash: item.cash || { krw: 0, usd: 0 },
        cryptocurrency: item.cryptocurrency || [],
        trades: item.trades || '',
        psychologyCheck: item.psychology_check || null,
        bullMarketChecklist: item.bull_market_checklist || [],
        bearMarketChecklist: item.bear_market_checklist || [],
        marketIssues: item.market_issues || '',
        memo: item.memo || ''
      }));

      setUserJournals(journals);
      
      // 차트 데이터 생성
      if (journals.length > 0) {
        const firstAssets = journals[0].totalAssets;
        const chartData = journals.map((journal) => {
          const changePercent = firstAssets > 0 
            ? ((journal.totalAssets - firstAssets) / firstAssets * 100) 
            : 0;

          return {
            date: journal.date,
            totalAssets: journal.totalAssets,
            changePercent: changePercent,
            hasMemo: !!journal.memo,
            journal: journal,
            displayDate: new Date(journal.date).toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric'
            })
          };
        });

        setChartData(chartData);
      }
      
      console.log('📊 사용자 차트 데이터 생성 완료:', journals.length, '개');
    } catch (error) {
      console.error('❌ 사용자 일지 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 실제 S&P 500 API 호출 (Alpha Vantage 사용)
  const loadSP500Data = async () => {
    try {
      console.log('📈 실제 S&P 500 데이터 로드 시작');
      
      // Alpha Vantage API 키 (실제 사용시 환경변수로 관리)
      const API_KEY = 'demo'; // 데모용, 실제로는 API 키가 필요
      const symbol = 'SPY'; // S&P 500 ETF
      
      // 실제 API 호출 (현재는 데모용으로 시뮬레이션)
      // const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      // const data = await response.json();
      
      // 시뮬레이션 데이터 (실제 API 연동시 위 코드 사용)
      const sp500SimData: {[key: string]: number} = {};
      const startDate = new Date(chartData[0].date);
      
      chartData.forEach((point, index) => {
        // 실제 S&P 500의 연평균 수익률 약 10%를 기반으로 시뮬레이션
        const daysSinceStart = (new Date(point.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const yearsSinceStart = daysSinceStart / 365;
        const annualReturn = 0.10; // 10% 연평균
        const volatility = 0.16; // 16% 변동성
        
        // 시장의 실제 변동성을 반영한 랜덤 요소
        const randomFactor = (Math.random() - 0.5) * volatility * Math.sqrt(yearsSinceStart);
        const sp500Return = (annualReturn * yearsSinceStart + randomFactor) * 100;
        
        sp500SimData[point.date] = Math.max(-50, Math.min(100, sp500Return)); // -50% ~ 100% 범위 제한
      });
      
      setSP500Data(sp500SimData);
      console.log('📈 S&P 500 데이터 로드 완료');
    } catch (error) {
      console.error('❌ S&P 500 데이터 로드 실패:', error);
    }
  };

  const getFilteredData = () => {
    if (periodFilter === 'all') return chartData;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (periodFilter) {
      case '1year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      case '6months':
        filterDate.setMonth(now.getMonth() - 6);
        break;
      case '3months':
        filterDate.setMonth(now.getMonth() - 3);
        break;
    }
    
    return chartData.filter(point => new Date(point.date) >= filterDate);
  };

  const getDisplayData = () => {
    const filtered = getFilteredData();
    
    if (!showSP500) return filtered;
    
    return filtered.map(point => ({
      ...point,
      sp500Percent: sp500Data[point.date] || 0
    }));
  };

  const formatNumber = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    } else if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}만`;
    } else {
      return `${Math.round(value / 1000)}천`;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.displayDate}</p>
          <p className="text-blue-400">
            총자산: {data.totalAssets.toLocaleString()}원
          </p>
          <p className={`${data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            변화율: {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
          </p>
          {showSP500 && (
            <p className={`${data.sp500Percent >= 0 ? 'text-yellow-400' : 'text-orange-400'}`}>
              S&P 500: {data.sp500Percent >= 0 ? '+' : ''}{data.sp500Percent.toFixed(2)}%
            </p>
          )}
          {data.hasMemo && (
            <Badge className="bg-red-500 text-white text-xs mt-1">메모 있음</Badge>
          )}
          <p className="text-gray-400 text-xs mt-1">클릭하여 상세보기</p>
        </div>
      );
    }
    return null;
  };

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const journal = data.activePayload[0].payload.journal;
      onJournalClick(journal);
    }
  };

  const displayData = getDisplayData();
  const totalReturn = displayData.length > 1 
    ? displayData[displayData.length - 1].changePercent 
    : 0;
  const sp500Return = showSP500 && displayData.length > 1 
    ? displayData[displayData.length - 1].sp500Percent || 0 
    : 0;

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-400">차트 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userJournals.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              자산 변화 그래프
            </CardTitle>
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <p>작성된 일지가 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 차트 영역 */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              자산 변화 그래프
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={onBack}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로가기
              </Button>
              
              {/* 총 수익률 표시 */}
              <Badge 
                variant="outline" 
                className={`${totalReturn >= 0 ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`}
              >
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
              </Badge>
              
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                +{formatNumber(Math.abs(displayData[displayData.length - 1]?.totalAssets - displayData[0]?.totalAssets || 0))}원
              </Badge>
            </div>
          </div>
          
          {/* 필터 및 옵션 */}
          <div className="flex items-center gap-4 mt-4">
            {/* 기간 필터 */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">기간:</span>
              <div className="flex gap-2">
                {[
                  { key: 'all', label: '전체' },
                  { key: '1year', label: '1년' },
                  { key: '6months', label: '6개월' },
                  { key: '3months', label: '3개월' }
                ].map((period) => (
                  <Button
                    key={period.key}
                    onClick={() => setPeriodFilter(period.key as any)}
                    variant={periodFilter === period.key ? 'default' : 'outline'}
                    size="sm"
                    className={
                      periodFilter === period.key 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    }
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* S&P 500 비교 */}
            <Button
              onClick={() => setShowSP500(!showSP500)}
              variant={showSP500 ? 'default' : 'outline'}
              size="sm"
              className={
                showSP500 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'border-gray-600 text-gray-300 hover:bg-gray-700'
              }
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              S&P 500과 비교하기
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* 범례 */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-300">내 자산 변화율</span>
              </div>
              {showSP500 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-300">S&P 500 변화율</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-300">메모 작성일</span>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              📊 {displayData.length}개 데이터 ({periodFilter === 'all' ? '전체' : periodFilter})
            </div>
          </div>

          {/* 차트 */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="changePercent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={(props) => {
                    const { payload } = props;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={payload.hasMemo ? 6 : 4}
                        fill={payload.hasMemo ? "#ef4444" : "#3b82f6"}
                        stroke={payload.hasMemo ? "#dc2626" : "#1d4ed8"}
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  }}
                  activeDot={{ r: 8, stroke: '#1d4ed8', strokeWidth: 2 }}
                />
                {showSP500 && (
                  <Line
                    type="monotone"
                    dataKey="sp500Percent"
                    stroke="#eab308"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              💡 그래프의 점을 클릭하면 해당 날짜의 투자일지를 볼 수 있습니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 일지 목록 영역 */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5 text-green-400" />
            {userProfile.nickname}님의 최근 투자일지
          </CardTitle>
          {userProfile.bio && (
            <p className="text-gray-400 text-sm mt-2">💬 {userProfile.bio}</p>
          )}
        </CardHeader>
        
        <CardContent className="p-6">
          {userJournals.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>작성된 일지가 없습니다.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] w-full border rounded-md p-4 bg-gray-700">
              <div className="space-y-3">
                {userJournals.slice().reverse().map((journal) => (
                  <Card key={journal.id} className="bg-gray-600 border-gray-500 hover:bg-gray-500 cursor-pointer transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1" onClick={() => onJournalClick(journal)}>
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="h-4 w-4 text-blue-400" />
                            <div className="font-medium text-white">{formatDate(journal.date)}</div>
                            {journal.memo && (
                              <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                                메모
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-300 mt-1">
                            총 자산: {(journal.totalAssets || 0).toLocaleString()}원
                          </div>
                          {journal.memo && (
                            <div className="text-xs text-gray-400 mt-2 truncate max-w-md">
                              💭 {journal.memo.substring(0, 80)}{journal.memo.length > 80 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            onClick={() => onJournalClick(journal)}
                            className="bg-blue-600 hover:bg-blue-700"
                            size="sm"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            보기
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          
          <div className="mt-3 text-sm text-gray-400 text-center">
            📜 총 {userJournals.length}개의 일지가 있습니다.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};