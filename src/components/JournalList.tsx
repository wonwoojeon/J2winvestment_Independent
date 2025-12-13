import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Eye, Edit, Trash2, Brain } from 'lucide-react';
import { InvestmentJournal } from '@/types/investment';

interface JournalListProps {
  journals: InvestmentJournal[];
  onEdit: (journal: InvestmentJournal) => void;
  onView: (journal: InvestmentJournal) => void;
  onDelete: (id: string) => void;
}

export const JournalList: React.FC<JournalListProps> = ({ 
  journals, 
  onEdit, 
  onView, 
  onDelete 
}) => {
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  if (journals.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-8 text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-bold mb-2 text-white">아직 작성된 일지가 없습니다</h3>
          <p className="text-gray-400 mb-6">
            첫 번째 투자일지를 작성해보세요!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {journals.map((journal) => (
        <Card key={journal.id} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-white">
                    {formatDate(journal.date)}
                  </span>
                  
                  {/* 메모 표시 */}
                  {journal.memo && (
                    <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                      메모
                    </Badge>
                  )}
                  
                  {/* 심리지표 표시 */}
                  {journal.psychologyCheck && (
                    <Badge variant="outline" className="border-purple-500 text-purple-400 text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      Fear&Greed: {journal.psychologyCheck.fearGreedIndex}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    총자산: {formatNumber(journal.totalAssets)}원
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    해외주식: {journal.foreignStocks?.length || 0}개
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    국내주식: {journal.domesticStocks?.length || 0}개
                  </div>
                </div>

                {/* 메모 미리보기 */}
                {journal.memo && (
                  <div className="bg-gray-700 p-3 rounded text-xs text-gray-300 mb-2">
                    <p className="line-clamp-2">
                      {journal.memo.substring(0, 100)}
                      {journal.memo.length > 100 && '...'}
                    </p>
                  </div>
                )}

                {/* 매매내역 미리보기 */}
                {journal.trades && (
                  <div className="bg-gray-700 p-2 rounded text-xs text-blue-300 mb-2">
                    <span className="font-medium">매매: </span>
                    {journal.trades.substring(0, 50)}
                    {journal.trades.length > 50 && '...'}
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  onClick={() => onView(journal)}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  보기
                </Button>
                <Button
                  onClick={() => onEdit(journal)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  수정
                </Button>
                <Button
                  onClick={() => {
                    if (confirm('정말로 이 일지를 삭제하시겠습니까?')) {
                      onDelete(journal.id);
                    }
                  }}
                  variant="outline"
                  className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};