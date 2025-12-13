import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, TrendingUp, TrendingDown, DollarSign, CheckCircle, FileText, ChevronDown, ChevronUp, Trash2, Brain } from 'lucide-react';
import { InvestmentJournal } from '@/types/investment';
import { supabase } from '@/lib/supabase';

interface JournalDetailProps {
  journal: InvestmentJournal;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  exchangeRate: number;
}

export const JournalDetail = ({ journal, onBack, onEdit, onDelete, exchangeRate }: JournalDetailProps) => {
  // 🔥 현재 사용자 정보 상태 추가
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);

  // 🔥 현재 사용자 확인
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      // 일지 작성자와 현재 사용자가 같은지 확인
      if (user && journal.user_id) {
        setIsOwner(user.id === journal.user_id);
      } else if (!user) {
        // 로그인하지 않은 경우 소유자가 아님
        setIsOwner(false);
      } else if (!journal.user_id) {
        // 일지에 사용자 ID가 없는 경우 (구버전 데이터 등) - 본인 것으로 간주하거나 정책에 따라 결정
        // 여기서는 안전하게 false로 처리하되, 본인이 작성한 직후에는 true일 수 있음
        // 하지만 보통 user_id는 필수이므로 이 경우는 드묾
        setIsOwner(false);
      }
    };

    getCurrentUser();
  }, [journal.user_id]);

  // 🔥 매매내역 및 메모가 있을 때 기본으로 펼쳐진 상태로 설정
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    assetDetails: false,
    trades: !!(journal.trades && journal.trades.trim().length > 0), // 내용이 있으면 펼쳐진 상태
    psychology: true,
    checklists: true,
    memo: !!(journal.memo && journal.memo.trim().length > 0) || !!(journal.marketIssues && journal.marketIssues.trim().length > 0) // 내용이 있으면 펼쳐진 상태
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

  // 해외주식 총액 (USD -> KRW) - 완전한 안전성 보장
  const foreignStocksTotal = safeJournal.foreignStocks.reduce((sum, stock) => {
    const price = Number(stock?.price) || 0;
    const quantity = Number(stock?.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  const foreignStocksTotalKRW = foreignStocksTotal * exchangeRate;

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
  const cryptoTotalKRW = cryptoTotal * exchangeRate;

  // 현금 총액 - 안전성 보장
  const cashKrw = Number(safeJournal.cash.krw) || 0;
  const cashUsd = Number(safeJournal.cash.usd) || 0;
  const cashTotal = cashKrw + (cashUsd * exchangeRate);

  // 전체 자산 총액
  const totalAssets = foreignStocksTotalKRW + domesticStocksTotal + cryptoTotalKRW + cashTotal;

  const formatNumber = (num: number) => {
    return isNaN(num) ? '0' : Math.floor(num).toLocaleString();
  };

  // Fear & Greed Index 분류 함수
  const getFearGreedClassification = (value: number) => {
    if (value >= 75) return { text: '극도의 탐욕', color: 'text-red-500' };
    if (value >= 55) return { text: '탐욕', color: 'text-orange-500' };
    if (value >= 45) return { text: '중립', color: 'text-yellow-500' };
    if (value >= 25) return { text: '공포', color: 'text-blue-500' };
    return { text: '극도의 공포', color: 'text-purple-500' };
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 bg-gray-900 text-white min-h-screen">
      {/* 🔥 헤더 - 작성자만 수정/삭제 버튼 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
          <h1 className="text-2xl font-bold">{journal.date} 투자일지</h1>
        </div>
        {/* 🔥 작성자만 수정/삭제 버튼 표시 */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleDelete} 
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </Button>
            <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700">
              <Edit className="h-4 w-4 mr-2" />
              수정
            </Button>
          </div>
        )}
      </div>

      {/* 🔥 다른 사람의 일지일 때 안내 메시지 표시 - 본인이 작성한 일지일때는 표시 안함 */}
      {!isOwner && currentUser && journal.user_id !== currentUser.id && (
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
                                {formatNumber((stock.price || 0) * (stock.quantity || 0) * exchangeRate)}원
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

                  {/* 현금 */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-300">
                      <Badge variant="outline" className="border-blue-500 text-blue-500">현금</Badge>
                    </h3>
                    <div className="space-y-2">
                      {cashKrw > 0 && (
                        <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                          <div className="font-medium text-white">원화 (KRW)</div>
                          <div className="font-semibold text-white">{formatNumber(cashKrw)}원</div>
                        </div>
                      )}
                      {cashUsd > 0 && (
                        <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow-sm">
                          <div className="font-medium text-white">달러 (USD)</div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {formatNumber(cashUsd * exchangeRate)}원
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
                {/* Fear & Greed Index */}
                <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                  <div className="text-sm text-gray-400 mb-2">Fear & Greed Index</div>
                  <div className="text-3xl font-bold text-purple-400 mb-1">
                    {safeJournal.psychologyCheck.fearGreedIndex || 50}
                  </div>
                  <div className={`text-sm font-medium ${getFearGreedClassification(safeJournal.psychologyCheck.fearGreedIndex || 50).color}`}>
                    {getFearGreedClassification(safeJournal.psychologyCheck.fearGreedIndex || 50).text}
                  </div>
                </div>

                {/* M2 유동성 */}
                {safeJournal.psychologyCheck.m2MoneySupply && (
                  <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                    <div className="text-sm text-gray-400 mb-2">M2 유동성 (미국기준)</div>
                    <div className="text-lg font-semibold text-white">
                      {safeJournal.psychologyCheck.m2MoneySupply}
                    </div>
                  </div>
                )}

                {/* 신용잔고비율 */}
                {safeJournal.psychologyCheck.confidenceLevel && (
                  <div className="text-center p-4 bg-gray-700 rounded-md shadow-sm">
                    <div className="text-sm text-gray-400 mb-2">신용잔고비율 (미국기준)</div>
                    <div className="text-lg font-semibold text-white">
                      {safeJournal.psychologyCheck.confidenceLevel}
                    </div>
                  </div>
                )}
              </div>
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
                        <div key={item.id || index} className="flex items-center gap-2 text-sm text-gray-300">
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
                        <div key={item.id || index} className="flex items-center gap-2 text-sm text-gray-300">
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
      {(journal.marketIssues || journal.memo) && (
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

                {journal.memo && (
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-300">투자 메모</h3>
                    <div className="whitespace-pre-wrap text-sm bg-gray-700 p-4 rounded-md text-gray-300">
                      {journal.memo}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};