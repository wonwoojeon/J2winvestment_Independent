import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, TrendingUp, TrendingDown, DollarSign, CheckCircle, FileText, ChevronDown, ChevronUp, Trash2, Brain } from 'lucide-react';
import { InvestmentJournal } from '@/types/investment';
import { supabase } from '@/lib/supabase';
import { getImportantMemoTag, getMemoText } from '@/utils/memo';
import { getJournalExchangeRate } from '@/utils/exchangeRate';
import { callOpenAiProxy } from '@/lib/llm';

interface JournalDetailProps {
  journal: InvestmentJournal;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  exchangeRate: number;
  hideAssetAmounts?: boolean;
}

export const JournalDetail = ({ journal, onBack, onEdit, onDelete, exchangeRate, hideAssetAmounts }: JournalDetailProps) => {
  // 🔥 현재 사용자 정보 상태 추가
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const memoText = getMemoText(journal.memo);
  const importantTag = getImportantMemoTag(journal.memo);
  const [aiComments, setAiComments] = useState<{ id: string; sentiment: 'pro' | 'con'; persona: string; content: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const hasComments = aiComments.length > 0;

  // 🔥 현재 사용자 확인
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const userId = user?.id;
      const owner = Boolean(userId && journal.user_id && userId === journal.user_id);
      setIsOwner(owner);
    };

    getCurrentUser();
  }, [journal.user_id]);

  useEffect(() => {
    const loadComments = async () => {
      if (!journal.id) return;
      try {
        const { data, error } = await supabase
          .from('journal_ai_comments')
          .select('id, sentiment, persona, content')
          .eq('journal_id', journal.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setAiComments((data || []) as any);
      } catch (error) {
        console.error('❌ AI 댓글 로드 실패:', error);
      }
    };
    loadComments();
  }, [journal.id]);

  // 🔥 매매내역 및 메모가 있을 때 기본으로 펼쳐진 상태로 설정
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    assetDetails: false,
    trades: !!(journal.trades && journal.trades.trim().length > 0), // 내용이 있으면 펼쳐진 상태
    psychology: true,
    psychologyExtras: false,
    checklists: true,
    memo: !!memoText || !!(journal.marketIssues && journal.marketIssues.trim().length > 0), // 내용이 있으면 펼쳐진 상태
    plan: !!(journal.planText || journal.executionText || journal.deviationReason)
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 일지 전체 삭제 확인 함수
  const handleDelete = () => {
    const firstConfirm = window.confirm(`정말로 ${journal.date} 일지를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    
    if (firstConfirm) {
      const secondConfirm = window.confirm(`한 번 더 확인합니다.\n\n${journal.date} 투자일지를 완전히 삭제하시겠습니까?`);
      
      if (secondConfirm) {
        onDelete(journal.id);
      }
    }
  };

  // 안전한 데이터 접근을 위한 기본값 설정
  const safeJournal = {
    ...journal,
    foreignStocks: journal.foreignStocks || [],
    domesticStocks: journal.domesticStocks || [],
    cryptocurrency: journal.cryptocurrency || [],
    cash: journal.cash || { krw: 0, usd: 0 },
    psychologyCheck: journal.psychologyCheck || { fearGreedIndex: 50 },
    bullMarketChecklist: journal.bullMarketChecklist || [],
    bearMarketChecklist: journal.bearMarketChecklist || []
  };

  const effectiveRate = getJournalExchangeRate(journal, exchangeRate);

  // 해외주식 총액 (USD -> KRW) - 완전한 안전성 보장
  const foreignStocksTotal = safeJournal.foreignStocks.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  const foreignStocksTotalKRW = foreignStocksTotal * effectiveRate;

  // 국내주식 총액 - 안전성 보장
  const domesticStocksTotal = safeJournal.domesticStocks.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);

  // 암호화폐 총액 (USD -> KRW) - 안전성 보장
  const cryptoTotal = safeJournal.cryptocurrency.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  const cryptoTotalKRW = cryptoTotal * effectiveRate;

  // 현금 총액 - 안전성 보장
  const cashKrw = Number(safeJournal.cash.krw) || 0;
  const cashUsd = Number(safeJournal.cash.usd) || 0;
  const cashTotal = cashKrw + (cashUsd * effectiveRate);

  // 전체 자산 총액
  const totalAssets = foreignStocksTotalKRW + domesticStocksTotal + cryptoTotalKRW + cashTotal;

  const formatNumber = (num: number) => {
    return isNaN(num) ? '0' : Math.floor(num).toLocaleString();
  };

  const formatCurrency = (num: number) => (hideAssetAmounts ? '비공개' : `${formatNumber(num)}원`);

  const buildAiCommentPrompt = () => {
    const assetSummary = [
      `총자산 ${formatNumber(totalAssets)}원`,
      `현금 KRW ${formatNumber(cashKrw)}원 / USD ${formatNumber(cashUsd)}달러`,
      `해외주식 ${formatNumber(foreignStocksTotalKRW)}원`,
      `국내주식 ${formatNumber(domesticStocksTotal)}원`,
      `크립토 ${formatNumber(cryptoTotalKRW)}원`
    ].join(', ');

    return [
      `일지 날짜: ${journal.date}`,
      `심리지표: F&G ${safeJournal.psychologyCheck.fearGreedIndex ?? '-'}, VIX ${safeJournal.psychologyCheck.vixIndex ?? '-'}, DXY ${safeJournal.psychologyCheck.dxyIndex ?? '-'}, 10Y ${safeJournal.psychologyCheck.us10yYield ?? '-'}`,
      `자산 요약: ${assetSummary}`,
      `매매/전략 메모: ${memoText || '없음'}`,
      `시장 이슈: ${journal.marketIssues || '없음'}`,
      `계획/실행/이탈: ${journal.planText || '-'} / ${journal.executionText || '-'} / ${journal.deviationReason || '-'}`
    ].join('\n');
  };

  const parseCommentsPayload = (raw: string) => {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    const jsonStart = candidate.indexOf('[');
    const jsonEnd = candidate.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonText = candidate.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonText);
    }
    try {
      return JSON.parse(candidate);
    } catch {
      const objects = candidate.match(/\{[\s\S]*?\}/g);
      if (!objects || objects.length === 0) {
        throw new Error('AI 댓글 JSON 파싱 실패');
      }
      return objects.map((item) => JSON.parse(item));
    }
  };

  const handleGenerateComments = async () => {
    if (!journal.id || !isOwner) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const prompt = buildAiCommentPrompt();
      const messages = [
        {
          role: 'system' as const,
          content:
            '너는 투자 일지에 대한 코멘터다. 반드시 JSON 배열로만 응답하라. 코드블록(```) 금지. 각 원소는 { "sentiment": "pro" | "con", "persona": "짧은 페르소나", "comment": "한국어 댓글" } 형식이다. 찬성 5개, 반대 5개. 댓글은 사실 기반, 과장 금지, 1~2문장. 다른 텍스트는 절대 출력하지 말라.'
        },
        {
          role: 'user' as const,
          content: `다음 정보를 참고해 댓글을 생성해라:\n${prompt}`
        }
      ];
      const res = await callOpenAiProxy(messages, { model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 420 });
      const content = res?.choices?.[0]?.message?.content || '[]';
      const parsed = parseCommentsPayload(content);
      const normalized = (Array.isArray(parsed) ? parsed : []).map((item: any, idx: number) => ({
        id: `${journal.id}-${idx}-${Date.now()}`,
        sentiment: item.sentiment === 'con' ? 'con' : 'pro',
        persona: String(item.persona || '페르소나'),
        content: String(item.comment || item.content || '')
      })).filter((item) => item.content.trim().length > 0);

      await supabase
        .from('journal_ai_comments')
        .delete()
        .eq('journal_id', journal.id)
        .eq('user_id', currentUser?.id);

      if (normalized.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('journal_ai_comments')
          .insert(
            normalized.map((item) => ({
              journal_id: journal.id,
              user_id: user?.id,
              sentiment: item.sentiment,
              persona: item.persona,
              content: item.content
            }))
          );
      }

      setAiComments(normalized);
    } catch (error) {
      console.error('❌ AI 댓글 생성 실패:', error);
      setAiError('댓글 생성 실패. 잠시 후 다시 시도해주세요.');
    } finally {
      setAiLoading(false);
    }
  };

  // Fear & Greed Index 분류 함수
  const getFearGreedClassification = (value: number) => {
    if (value >= 75) return { text: '극도의 탐욕', color: 'text-red-500' };
    if (value >= 55) return { text: '탐욕', color: 'text-orange-500' };
    if (value >= 45) return { text: '중립', color: 'text-yellow-500' };
    if (value >= 25) return { text: '공포', color: 'text-blue-500' };
    return { text: '극도의 공포', color: 'text-purple-500' };
  };

  const planStatusLabels: Record<string, string> = {
    planned: '계획',
    executed: '실행',
    deviated: '이탈'
  };

  const planStatusClasses: Record<string, string> = {
    planned: 'border-slate-600 text-slate-300 bg-slate-800/40',
    executed: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    deviated: 'border-rose-500/40 text-rose-400 bg-rose-500/10'
  };

  const coreIndicators = [
    { label: 'VIX', value: safeJournal.psychologyCheck.vixIndex },
    { label: 'Put/Call Ratio', value: safeJournal.psychologyCheck.putCallRatio },
    { label: 'S&P 500 RSI (14)', value: safeJournal.psychologyCheck.sp500Rsi14 },
    { label: '달러 인덱스 (DXY)', value: safeJournal.psychologyCheck.dxyIndex },
    { label: '미국 10년물 금리', value: safeJournal.psychologyCheck.us10yYield }
  ];

  const extraIndicators = [
    { label: 'GDPNow (미국)', value: safeJournal.psychologyCheck.gdpNow },
    { label: 'High Yield Spread', value: safeJournal.psychologyCheck.highYieldSpread },
    { label: 'Fed 금리 동결 확률', value: safeJournal.psychologyCheck.fedFundsProbability },
    { label: '실업률', value: safeJournal.psychologyCheck.unemploymentRate },
    { label: 'M2 유동성 (미국기준)', value: safeJournal.psychologyCheck.m2MoneySupply },
    { label: '마진 부채', value: safeJournal.psychologyCheck.marginDebt },
    { label: '신용잔고비율', value: safeJournal.psychologyCheck.marginRatio || safeJournal.psychologyCheck.confidenceLevel }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-white min-h-screen rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950/60 via-slate-950/50 to-slate-950/40 backdrop-blur-2xl shadow-2xl">
      {/* 🔥 헤더 - 작성자만 수정/삭제 버튼 표시 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
          <h1 className="text-2xl font-bold break-keep">{journal.date} 투자일지</h1>
        </div>
        {/* 🔥 작성자만 수정/삭제 버튼 표시 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={handleDelete} 
            variant="outline"
            disabled={!isOwner}
            className={`border-white/10 text-slate-200 bg-slate-900/70 hover:bg-rose-500/20 hover:text-rose-100 ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            삭제
          </Button>
          <Button onClick={onEdit} disabled={!isOwner} className={`bg-slate-900/80 text-slate-100 hover:bg-slate-800 ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Edit className="h-4 w-4 mr-2" />
            수정
          </Button>
        </div>
      </div>

      {/* 🔥 다른 사람의 일지일 때 안내 메시지 표시 - 본인이 작성한 일지일때는 표시 안함 */}
      {!isOwner && currentUser && journal.user_id && journal.user_id !== currentUser.id && (
        <Card className="bg-yellow-900/20 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">다른 사용자의 일지</span>
            </div>
            <p className="text-sm text-yellow-300">
              이 일지는 다른 사용자가 작성한 일지입니다. 읽기 전용으로만 볼 수 있으며, 수정이나 삭제는 불가능합니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 자산 현황 - 평가손익 제거 */}
      <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
        <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('assets')}>
          <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              자산 현황
            </div>
            {expandedSections.assets ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </CardTitle>
        </CardHeader>
        {expandedSections.assets && (
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                <div className="text-sm text-gray-400">총 자산</div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatCurrency(journal.totalAssets || totalAssets)}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                <div className="text-sm text-gray-400">해외주식</div>
                <div className="text-lg font-semibold text-white">
                  {formatCurrency(foreignStocksTotalKRW)}
                </div>
                <div className="text-xs text-gray-500">
                  {hideAssetAmounts ? '비공개' : `$${formatNumber(foreignStocksTotal)}`}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                <div className="text-sm text-gray-400">국내주식</div>
                <div className="text-lg font-semibold text-white">
                  {formatCurrency(domesticStocksTotal)}
                </div>
              </div>
            </div>

            {/* 자산 상세 - 토스 스타일: 버튼 hover 효과 */}
            <div className="border-t border-gray-700 pt-4">
              <Button
                variant="ghost"
                onClick={() => toggleSection('assetDetails')}
                className="w-full flex items-center justify-between text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <span>자산 상세 보기</span>
                {expandedSections.assetDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {expandedSections.assetDetails && (
                hideAssetAmounts ? (
                  <div className="mt-4 text-sm text-gray-400">
                    자산 상세 정보는 비공개로 설정되어 있습니다.
                  </div>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  {/* 해외주식 - 토스 스타일: 미니 카드 */}
                  {safeJournal.foreignStocks.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-300">
                        <Badge variant="outline" className="border-blue-500 text-blue-500">해외주식</Badge>
                      </h3>
                      <div className="space-y-2">
                        {safeJournal.foreignStocks.map((stock, index) => (
                          <div key={stock.id || index} className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                            <div>
                              <div className="font-medium text-white">{stock.symbol || '미지정'}</div>
                              <div className="text-sm text-gray-400">
                                {formatNumber(stock.quantity || 0)}주 × ${formatNumber(stock.price || 0)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-white">
                                {formatCurrency((stock.price || 0) * (stock.quantity || 0) * effectiveRate)}
                              </div>
                              <div className="text-sm text-gray-500">
                                ${formatNumber((stock.price || 0) * (stock.quantity || 0))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 국내주식 */}
                  {safeJournal.domesticStocks.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-300">
                        <Badge variant="outline" className="border-blue-500 text-blue-500">국내주식</Badge>
                      </h3>
                      <div className="space-y-2">
                        {safeJournal.domesticStocks.map((stock, index) => (
                          <div key={stock.id || index} className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                            <div>
                              <div className="font-medium text-white">{stock.symbol || '미지정'}</div>
                              <div className="text-sm text-gray-400">
                                {formatNumber(stock.quantity || 0)}주 × {formatNumber(stock.price || 0)}원
                              </div>
                            </div>
                            <div className="font-semibold text-white">
                              {formatCurrency((stock.price || 0) * (stock.quantity || 0))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 현금 */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-300">
                      <Badge variant="outline" className="border-blue-500 text-blue-500">현금</Badge>
                    </h3>
                    <div className="space-y-2">
                      {cashKrw > 0 && (
                        <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                          <div className="font-medium text-white">원화 (KRW)</div>
                          <div className="font-semibold text-white">{formatCurrency(cashKrw)}</div>
                        </div>
                      )}
                      {cashUsd > 0 && (
                        <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                          <div className="font-medium text-white">달러 (USD)</div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {formatCurrency(cashUsd * effectiveRate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              ${formatNumber(cashUsd)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 🔥 심리 지표 섹션 추가 - 저장된 심리지표 정보 표시 */}
      {safeJournal.psychologyCheck && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('psychology')}>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                심리 지표
              </div>
              {expandedSections.psychology ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </CardTitle>
          </CardHeader>
          {expandedSections.psychology && (
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                  <div className="text-sm text-gray-400 mb-2">Fear & Greed Index</div>
                  <div className="text-3xl font-bold text-purple-400 mb-1">
                    {safeJournal.psychologyCheck.fearGreedIndex || 50}
                  </div>
                  <div className={`text-sm font-medium ${getFearGreedClassification(safeJournal.psychologyCheck.fearGreedIndex || 50).color}`}>
                    {getFearGreedClassification(safeJournal.psychologyCheck.fearGreedIndex || 50).text}
                  </div>
                </div>

                {coreIndicators.map((indicator) => (
                  <div key={indicator.label} className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                    <div className="text-sm text-gray-400 mb-2">{indicator.label}</div>
                    <div className="text-lg font-semibold text-white">
                      {indicator.value || '-'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('psychologyExtras')}
                  className="text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  {expandedSections.psychologyExtras ? '접기' : '더보기'}
                  {expandedSections.psychologyExtras ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                </Button>
              </div>

              {expandedSections.psychologyExtras && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  {extraIndicators.map((indicator) => (
                    <div key={indicator.label} className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                      <div className="text-sm text-gray-400 mb-2">{indicator.label}</div>
                      <div className="text-lg font-semibold text-white">
                        {indicator.value || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* 매매내역 - 토스 스타일 */}
      {journal.trades && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('trades')}>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                매매내역
              </div>
              {expandedSections.trades ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </CardTitle>
          </CardHeader>
          {expandedSections.trades && (
            <CardContent className="p-4">
              <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                {journal.trades}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 체크리스트 - 토스 스타일: 미니멀 리스트, 색상 액센트 */}
      {(safeJournal.bullMarketChecklist.length > 0 || safeJournal.bearMarketChecklist.length > 0) && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('checklists')}>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-500" />
                투자 체크리스트
              </div>
              {expandedSections.checklists ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </CardTitle>
          </CardHeader>
          {expandedSections.checklists && (
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 상승장 체크리스트 */}
                {safeJournal.bullMarketChecklist.length > 0 && (
                  <div>
                    <h3 className="text-green-400 flex items-center gap-2 mb-4 text-lg font-semibold">
                      <TrendingUp className="h-5 w-5" />
                      상승장 체크리스트
                    </h3>
                    <div className="space-y-2">
                      {safeJournal.bullMarketChecklist.map((item, index) => (
                        <div key={item.id || index} className="flex items-center gap-2 text-sm text-slate-200 dark:text-slate-100">
                          <span>{item.checked ? '✅' : '☐'}</span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      체크된 항목: {safeJournal.bullMarketChecklist.filter(item => item.checked).length}개 / 전체: {safeJournal.bullMarketChecklist.length}개
                    </div>
                  </div>
                )}

                {/* 하락장 체크리스트 */}
                {safeJournal.bearMarketChecklist.length > 0 && (
                  <div>
                    <h3 className="text-red-400 flex items-center gap-2 mb-4 text-lg font-semibold">
                      <TrendingDown className="h-5 w-5" />
                      하락장 체크리스트
                    </h3>
                    <div className="space-y-2">
                      {safeJournal.bearMarketChecklist.map((item, index) => (
                        <div key={item.id || index} className="flex items-center gap-2 text-sm text-slate-200 dark:text-slate-100">
                          <span>{item.checked ? '✅' : '☐'}</span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      체크된 항목: {safeJournal.bearMarketChecklist.filter(item => item.checked).length}개 / 전체: {safeJournal.bearMarketChecklist.length}개
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 🔥 시장 이슈 및 메모 - 모든 삭제 버튼 제거 */}
      {(journal.marketIssues || memoText) && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('memo')}>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                메모 및 이슈
              </div>
              {expandedSections.memo ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </CardTitle>
          </CardHeader>
          {expandedSections.memo && (
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {journal.marketIssues && (
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-300">시장 이슈</h3>
                    <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                      {journal.marketIssues}
                    </div>
                  </div>
                )}

                {memoText && (
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-300">투자 메모</h3>
                    <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                      {importantTag && (
                        <div className="text-amber-300 font-semibold mb-2">#{importantTag}</div>
                      )}
                      {memoText}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 플랜 추적 */}
      {(journal.planText || journal.executionText || journal.deviationReason) && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('plan')}>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                플랜 추적
              </div>
              <div className="flex items-center gap-3">
                {journal.planStatus && (
                  <Badge variant="outline" className={`text-xs ${planStatusClasses[journal.planStatus] || ''}`}>
                    {planStatusLabels[journal.planStatus] || journal.planStatus}
                  </Badge>
                )}
                {expandedSections.plan ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </div>
            </CardTitle>
          </CardHeader>
          {expandedSections.plan && (
            <CardContent className="p-4 space-y-4">
              {journal.planText && (
                <div>
                  <h3 className="font-semibold mb-2 text-gray-300">계획</h3>
                  <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                    {journal.planText}
                  </div>
                </div>
              )}
              {journal.executionText && (
                <div>
                  <h3 className="font-semibold mb-2 text-gray-300">실행</h3>
                  <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                    {journal.executionText}
                  </div>
                </div>
              )}
              {journal.deviationReason && (
                <div>
                  <h3 className="font-semibold mb-2 text-gray-300">이탈 사유</h3>
                  <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                    {journal.deviationReason}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card className="bg-slate-950/40 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setAiOpen((prev) => !prev)}
              className="flex items-center gap-2 text-left"
            >
              <CardTitle className="text-lg text-slate-100">AI 댓글 (찬성/반대)</CardTitle>
              {aiOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {hasComments && !aiOpen && (
              <Badge variant="outline" className="border-emerald-400/40 text-emerald-300 bg-emerald-500/10 w-fit">
                생성됨
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-200/70">최근 일지 기준으로 5개 찬성, 5개 반대 페르소나 댓글</p>
        </CardHeader>
        {aiOpen && (
          <CardContent className="space-y-3">
            {aiError && <p className="text-sm text-rose-300">{aiError}</p>}
            {aiComments.length === 0 && (
              <p className="text-sm text-slate-200/60">아직 생성된 댓글이 없습니다.</p>
            )}
            {aiComments.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {aiComments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={comment.sentiment === 'pro'
                          ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                          : 'border-rose-400/40 text-rose-300 bg-rose-500/10'
                        }
                      >
                        {comment.sentiment === 'pro' ? '찬성' : '반대'}
                      </Badge>
                      <span className="text-sm text-slate-200/80">{comment.persona}</span>
                    </div>
                    <p className="text-sm text-slate-100/90">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleGenerateComments}
                disabled={!isOwner || aiLoading}
                className="bg-blue-900/80 hover:bg-blue-800/80 text-white"
              >
                {aiLoading ? '생성 중...' : hasComments ? '댓글 다시 생성' : '댓글 생성'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
