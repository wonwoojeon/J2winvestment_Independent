import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Calendar, DollarSign, CheckCircle, FileText, ChevronDown, ChevronUp, Brain, Eye } from 'lucide-react';
import { PublicJournalSearchResult } from '@/types/investment';
import { getImportantMemoTag, getMemoText } from '@/utils/memo';
import { getJournalExchangeRate } from '@/utils/exchangeRate';

interface PublicJournalDetailProps {
  result: PublicJournalSearchResult;
  onBack: () => void;
  exchangeRate: number;
}

export const PublicJournalDetail: React.FC<PublicJournalDetailProps> = ({ 
  result, 
  onBack, 
  exchangeRate 
}) => {
  const { journal, user_profile } = result;
  const memoText = getMemoText(journal.memo);
  const importantTag = getImportantMemoTag(journal.memo);
  const effectiveRate = getJournalExchangeRate(journal, exchangeRate);
  
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    assetDetails: false,
    trades: !!(journal.trades && journal.trades.trim().length > 0),
    psychology: true,
    psychologyExtras: false,
    checklists: true,
    memo: !!memoText || !!(journal.marketIssues && journal.marketIssues.trim().length > 0)
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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

  // 자산 계산
  const foreignStocksTotal = safeJournal.foreignStocks.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  const foreignStocksTotalKRW = foreignStocksTotal * effectiveRate;

  const domesticStocksTotal = safeJournal.domesticStocks.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);

  const cryptoTotal = safeJournal.cryptocurrency.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  const cryptoTotalKRW = cryptoTotal * effectiveRate;

  const cashKrw = Number(safeJournal.cash.krw) || 0;
  const cashUsd = Number(safeJournal.cash.usd) || 0;
  const cashTotal = cashKrw + (cashUsd * effectiveRate);

  const totalAssets = foreignStocksTotalKRW + domesticStocksTotal + cryptoTotalKRW + cashTotal;

  const formatNumber = (num: number) => {
    return isNaN(num) ? '0' : Math.floor(num).toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  // Fear & Greed Index 레벨 표시 함수
  const getFearGreedLevel = (index: number) => {
    if (index >= 75) return { text: 'Extreme Greed', color: 'text-red-500' };
    if (index >= 55) return { text: 'Greed', color: 'text-orange-500' };
    if (index >= 45) return { text: 'Neutral', color: 'text-yellow-500' };
    if (index >= 25) return { text: 'Fear', color: 'text-blue-500' };
    return { text: 'Extreme Fear', color: 'text-green-500' };
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
      {/* 헤더 - 공개 일지임을 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="border-white/10 text-slate-200 bg-slate-900/70 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{formatDate(journal.date)} 투자일지</h1>
            <div className="flex items-center gap-2 mt-1">
              <User className="h-4 w-4 text-blue-400" />
              <span className="text-lg text-blue-400 font-medium">
                {user_profile.display_name || user_profile.nickname}
              </span>
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                @{user_profile.nickname}
              </Badge>
              <Badge className="bg-green-600 text-white">
                <Eye className="h-3 w-3 mr-1" />
                공개 일지
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 정보 */}
      {user_profile.bio && (
        <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">작성자 소개</span>
            </div>
            <p className="text-gray-300">{user_profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* 자산 현황 */}
      <Card className="bg-gray-800 border-0 shadow-md rounded-lg overflow-hidden">
        <CardHeader className="cursor-pointer bg-gray-700 p-4" onClick={() => toggleSection('assets')}>
          <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
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
                  {formatNumber(journal.totalAssets || totalAssets)}원
                </div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                <div className="text-sm text-gray-400">해외주식</div>
                <div className="text-lg font-semibold text-white">
                  {formatNumber(foreignStocksTotalKRW)}원
                </div>
                <div className="text-xs text-gray-500">
                  ${formatNumber(foreignStocksTotal)}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                <div className="text-sm text-gray-400">국내주식</div>
                <div className="text-lg font-semibold text-white">
                  {formatNumber(domesticStocksTotal)}원
                </div>
              </div>
            </div>

            {/* 자산 상세 */}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  {/* 해외주식 */}
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
                                {formatNumber((stock.price || 0) * (stock.quantity || 0) * effectiveRate)}원
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
                              {formatNumber((stock.price || 0) * (stock.quantity || 0))}원
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 심리지표 섹션 */}
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
                  <div className={`text-sm font-medium ${getFearGreedLevel(safeJournal.psychologyCheck.fearGreedIndex || 50).color}`}>
                    {getFearGreedLevel(safeJournal.psychologyCheck.fearGreedIndex || 50).text}
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

      {/* 매매내역 */}
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

      {/* 체크리스트 */}
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
                      🐂 상승장 체크리스트
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
                      🐻 하락장 체크리스트
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

      {/* 시장 이슈 및 메모 */}
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

      {/* 안내 메시지 */}
      <Card className="bg-gray-700 border-gray-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium">공개 일지 보기</span>
          </div>
          <p className="text-sm text-gray-400">
            이 일지는 <strong>@{user_profile.nickname}</strong>님이 공개로 설정한 투자일지입니다. 
            읽기 전용으로만 볼 수 있으며, 수정이나 삭제는 불가능합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
