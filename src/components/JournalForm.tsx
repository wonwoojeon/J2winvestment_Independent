import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Calculator, Brain, RefreshCw, Plus, Minus, DollarSign, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { InvestmentJournal, ChecklistItem } from '@/types/investment';
import { getDefaultChecklists } from '@/lib/storage';
import { AssetInput } from './AssetInput';
import { fetchComprehensivePsychologyData, getAccurateExchangeRate } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface JournalFormProps {
  onSubmit: (journal: InvestmentJournal) => void;
  initialData?: InvestmentJournal | null;
  onCancel: () => void;
}

export const JournalForm: React.FC<JournalFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const [formData, setFormData] = useState<InvestmentJournal>({
    id: initialData?.id || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    totalAssets: initialData?.totalAssets || 0,
    evaluation: initialData?.evaluation || 0,
    foreignStocks: initialData?.foreignStocks || [],
    domesticStocks: initialData?.domesticStocks || [],
    cash: initialData?.cash || { krw: 0, usd: 0 },
    cryptocurrency: initialData?.cryptocurrency || [],
    trades: initialData?.trades || '',
    psychologyCheck: initialData?.psychologyCheck || { 
      fearGreedIndex: 50,
      confidenceLevel: '',
      m2MoneySupply: '',
      marginDebt: '',
      marginRatio: '',
      marketSentiments: []
    },
    bullMarketChecklist: initialData?.bullMarketChecklist || [],
    bearMarketChecklist: initialData?.bearMarketChecklist || [],
    marketIssues: initialData?.marketIssues || '',
    memo: initialData?.memo || ''
  });

  const [exchangeRate, setExchangeRate] = useState(1300);
  const [psychologyLoading, setPsychologyLoading] = useState(false);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);

  // 초기 체크리스트 설정 (이전 기록 반영 로직 추가)
  useEffect(() => {
    const initializeChecklists = async () => {
      // 1. 수정 모드인 경우: 기존 데이터 그대로 사용
      if (initialData) {
        setFormData(prev => ({
          ...prev,
          bullMarketChecklist: initialData.bullMarketChecklist || [],
          bearMarketChecklist: initialData.bearMarketChecklist || []
        }));
        return;
      }

      // 2. 새 일지 작성 모드인 경우: 가장 최근 일지의 체크리스트 항목을 가져와서 체크만 해제
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: latestJournals } = await supabase
            .from('investment_journals')
            .select('bull_market_checklist, bear_market_checklist')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(1);

          if (latestJournals && latestJournals.length > 0) {
            const latest = latestJournals[0];
            
            // 최근 일지의 체크리스트가 있으면 그것을 사용하되, checked 상태만 false로 초기화
            if (latest.bull_market_checklist && latest.bull_market_checklist.length > 0) {
              const inheritedBullList = latest.bull_market_checklist.map((item: any) => ({
                ...item,
                checked: false // 체크 해제
              }));
              
              setFormData(prev => ({
                ...prev,
                bullMarketChecklist: inheritedBullList
              }));
            } else {
              // 최근 일지에 체크리스트가 없으면 기본값 사용
              loadDefaultChecklists('bull');
            }

            if (latest.bear_market_checklist && latest.bear_market_checklist.length > 0) {
              const inheritedBearList = latest.bear_market_checklist.map((item: any) => ({
                ...item,
                checked: false // 체크 해제
              }));
              
              setFormData(prev => ({
                ...prev,
                bearMarketChecklist: inheritedBearList
              }));
            } else {
              // 최근 일지에 체크리스트가 없으면 기본값 사용
              loadDefaultChecklists('bear');
            }
          } else {
            // 작성된 일지가 하나도 없으면 기본값 사용
            loadDefaultChecklists('all');
          }
        }
      } catch (error) {
        console.error('❌ 최근 체크리스트 로드 실패:', error);
        loadDefaultChecklists('all');
      }
    };

    initializeChecklists();
    
    // 초기 로드 시 환율 가져오기
    fetchExchangeRate();
  }, [initialData]);

  // 기본 체크리스트 로드 함수
  const loadDefaultChecklists = (type: 'bull' | 'bear' | 'all') => {
    const defaultChecklists = getDefaultChecklists();
    
    if (type === 'bull' || type === 'all') {
      const bullMarketChecklist: ChecklistItem[] = defaultChecklists.bullMarket.map((text, index) => ({
        id: `bull-${index}`,
        text,
        checked: false
      }));
      setFormData(prev => ({ ...prev, bullMarketChecklist }));
    }
    
    if (type === 'bear' || type === 'all') {
      const bearMarketChecklist: ChecklistItem[] = defaultChecklists.bearMarket.map((text, index) => ({
        id: `bear-${index}`,
        text,
        checked: false
      }));
      setFormData(prev => ({ ...prev, bearMarketChecklist }));
    }
  };

  // 🔥 환율 자동 불러오기
  const fetchExchangeRate = async () => {
    setExchangeRateLoading(true);
    try {
      const rate = await getAccurateExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('❌ 환율 fetch 실패:', error);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  // 🔥 심리지표 자동 패치 함수 (개선됨)
  const fetchPsychologyIndicators = async () => {
    setPsychologyLoading(true);
    try {
      const psychologyData = await fetchComprehensivePsychologyData();
      
      setFormData(prev => ({
        ...prev,
        psychologyCheck: {
          ...prev.psychologyCheck,
          fearGreedIndex: psychologyData.fearGreedIndex,
          m2MoneySupply: psychologyData.m2MoneySupply,
          marginDebt: psychologyData.marginDebt,
          marginRatio: psychologyData.marginRatio,
          confidenceLevel: psychologyData.marginRatio // 호환성 유지
        }
      }));

      alert(`심리지표가 업데이트되었습니다!\n\nFear & Greed: ${psychologyData.fearGreedIndex}\nM2 유동성: ${psychologyData.m2MoneySupply}\n마진 부채: ${psychologyData.marginDebt}`);
    } catch (error) {
      console.error('❌ 심리지표 fetch 실패:', error);
      alert('심리지표 업데이트에 실패했습니다. 수동으로 입력해주세요.');
    } finally {
      setPsychologyLoading(false);
    }
  };

  // 총 자산 계산
  const calculateTotalAssets = useCallback(() => {
    const foreignTotal = formData.foreignStocks.reduce((sum, stock) => 
      sum + (stock.price * stock.quantity), 0) * exchangeRate;
    
    const domesticTotal = formData.domesticStocks.reduce((sum, stock) => 
      sum + (stock.price * stock.quantity), 0);
    
    const cryptoTotal = formData.cryptocurrency.reduce((sum, crypto) => 
      sum + (crypto.price * crypto.quantity), 0) * exchangeRate;
    
    const cashTotal = (formData.cash.krw || 0) + ((formData.cash.usd || 0) * exchangeRate);
    
    const total = foreignTotal + domesticTotal + cryptoTotal + cashTotal;
    
    setFormData(prev => ({
      ...prev,
      totalAssets: Math.floor(total)
    }));
  }, [formData.foreignStocks, formData.domesticStocks, formData.cryptocurrency, formData.cash, exchangeRate]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  // 체크리스트 항목 추가/삭제/수정 함수들
  const addChecklistItem = (type: 'bullMarketChecklist' | 'bearMarketChecklist') => {
    const newItem: ChecklistItem = {
      id: `${type}-${Date.now()}`,
      text: '',
      checked: false
    };
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], newItem]
    }));
  };

  const removeChecklistItem = (type: 'bullMarketChecklist' | 'bearMarketChecklist', index: number) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const updateChecklistText = (type: 'bullMarketChecklist' | 'bearMarketChecklist', index: number, text: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? { ...item, text } : item)
    }));
  };

  const updateChecklistItem = (type: 'bullMarketChecklist' | 'bearMarketChecklist', index: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? { ...item, checked } : item)
    }));
  };

  const handleAssetChange = useCallback((type: 'foreignStocks' | 'domesticStocks' | 'cryptocurrency', stocks: any[]) => {
    setFormData(prev => ({ ...prev, [type]: stocks }));
  }, []);

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 py-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={onCancel} 
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">돌아가기</span>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {initialData ? '투자일지 수정' : '새 투자일지 작성'}
            </h1>
          </div>
          <Button 
            type="button" 
            onClick={handleSubmit} 
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
          >
            <Save className="h-4 w-4 mr-2" />
            저장하기
          </Button>
        </div>

        <div className="space-y-8">
          {/* 1. 기본 정보 섹션 */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              기본 설정
            </h2>
            <Card className="bg-slate-900 border-slate-800 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-400">날짜</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">환율 (USD/KRW)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-white focus:border-blue-500"
                      />
                      <Button 
                        type="button" 
                        onClick={fetchExchangeRate}
                        disabled={exchangeRateLoading}
                        variant="outline"
                        className="border-slate-700 hover:bg-slate-800 text-slate-300"
                      >
                        {exchangeRateLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">총 자산 (자동 계산)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${formatNumber(formData.totalAssets)}원`}
                        readOnly
                        className="bg-slate-950 border-slate-800 text-blue-400 font-bold font-mono"
                      />
                      <Button 
                        type="button" 
                        onClick={calculateTotalAssets}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 2. 자산 포트폴리오 섹션 */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              자산 포트폴리오
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-1 overflow-hidden">
                <AssetInput
                  title="🇺🇸 해외주식 (USD)"
                  stocks={formData.foreignStocks}
                  onStocksChange={(stocks) => handleAssetChange('foreignStocks', stocks)}
                  placeholder="종목명 (예: AAPL)"
                  currency=" USD"
                />
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-1 overflow-hidden">
                <AssetInput
                  title="🇰🇷 국내주식 (KRW)"
                  stocks={formData.domesticStocks}
                  onStocksChange={(stocks) => handleAssetChange('domesticStocks', stocks)}
                  placeholder="종목명 (예: 삼성전자)"
                  currency=" 원"
                />
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-1 overflow-hidden">
                <AssetInput
                  title="🪙 암호화폐 (USD)"
                  stocks={formData.cryptocurrency}
                  onStocksChange={(stocks) => handleAssetChange('cryptocurrency', stocks)}
                  placeholder="코인명 (예: BTC)"
                  currency=" USD"
                />
              </div>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-slate-300">💰 현금 보유액</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">원화 (KRW)</Label>
                      <Input
                        type="number"
                        value={formData.cash.krw}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cash: { ...prev.cash, krw: Number(e.target.value) }
                        }))}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">달러 (USD)</Label>
                      <Input
                        type="number"
                        value={formData.cash.usd}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cash: { ...prev.cash, usd: Number(e.target.value) }
                        }))}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 3. 시장 심리 분석 섹션 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                시장 심리 분석
              </h2>
              <Button
                type="button"
                onClick={fetchPsychologyIndicators}
                disabled={psychologyLoading}
                variant="outline"
                size="sm"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
              >
                {psychologyLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                지표 업데이트
              </Button>
            </div>
            
            <Card className="bg-slate-900 border-slate-800 shadow-lg overflow-hidden">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">Fear & Greed Index</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.psychologyCheck?.fearGreedIndex || 50}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          psychologyCheck: { ...prev.psychologyCheck, fearGreedIndex: Number(e.target.value) }
                        }))}
                        className="bg-slate-800 border-slate-700 text-white pl-10"
                      />
                      <div className={`absolute left-3 top-2.5 h-3 w-3 rounded-full ${
                        (formData.psychologyCheck?.fearGreedIndex || 50) > 75 ? 'bg-red-500' : 
                        (formData.psychologyCheck?.fearGreedIndex || 50) < 25 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">M2 유동성</Label>
                    <Input
                      value={formData.psychologyCheck?.m2MoneySupply || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        psychologyCheck: { ...prev.psychologyCheck, m2MoneySupply: e.target.value }
                      }))}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="자동 입력됨"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">마진 부채</Label>
                    <Input
                      value={formData.psychologyCheck?.marginDebt || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        psychologyCheck: { ...prev.psychologyCheck, marginDebt: e.target.value }
                      }))}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="자동 입력됨"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">신용잔고비율</Label>
                    <Input
                      value={formData.psychologyCheck?.marginRatio || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        psychologyCheck: { ...prev.psychologyCheck, marginRatio: e.target.value }
                      }))}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="자동 입력됨"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 4. 투자 체크리스트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800 shadow-lg">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> 상승장 체크리스트
                  </CardTitle>
                  <Button
                    type="button"
                    onClick={() => addChecklistItem('bullMarketChecklist')}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-emerald-500/20 text-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {formData.bullMarketChecklist.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3 group">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => updateChecklistItem('bullMarketChecklist', index, e.target.checked)}
                      className="mt-2 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <Input
                      value={item.text}
                      onChange={(e) => updateChecklistText('bullMarketChecklist', index, e.target.value)}
                      className="bg-transparent border-0 border-b border-slate-800 rounded-none px-0 focus:ring-0 focus:border-emerald-500 text-sm"
                      placeholder="체크리스트 항목 입력"
                    />
                    <Button
                      type="button"
                      onClick={() => removeChecklistItem('bullMarketChecklist', index)}
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 h-8 w-8 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-lg">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> 하락장 체크리스트
                  </CardTitle>
                  <Button
                    type="button"
                    onClick={() => addChecklistItem('bearMarketChecklist')}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-rose-500/20 text-rose-500"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {formData.bearMarketChecklist.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3 group">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => updateChecklistItem('bearMarketChecklist', index, e.target.checked)}
                      className="mt-2 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-rose-500/50"
                    />
                    <Input
                      value={item.text}
                      onChange={(e) => updateChecklistText('bearMarketChecklist', index, e.target.value)}
                      className="bg-transparent border-0 border-b border-slate-800 rounded-none px-0 focus:ring-0 focus:border-rose-500 text-sm"
                      placeholder="체크리스트 항목 입력"
                    />
                    <Button
                      type="button"
                      onClick={() => removeChecklistItem('bearMarketChecklist', index)}
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 h-8 w-8 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 5. 메모 및 기록 */}
          <Card className="bg-slate-900 border-slate-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-100">투자 기록 및 메모</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-400">매매 내역</Label>
                <Textarea
                  value={formData.trades}
                  onChange={(e) => setFormData(prev => ({ ...prev, trades: e.target.value }))}
                  placeholder="오늘의 매매 종목과 가격을 기록하세요"
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">시장 이슈</Label>
                <Textarea
                  value={formData.marketIssues}
                  onChange={(e) => setFormData(prev => ({ ...prev, marketIssues: e.target.value }))}
                  placeholder="주요 뉴스나 시장 특이사항을 기록하세요"
                  className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">투자 메모</Label>
                <Textarea
                  value={formData.memo}
                  onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="오늘의 투자 아이디어나 감정을 기록하세요"
                  className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JournalForm;