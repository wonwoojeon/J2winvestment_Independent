import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, ArrowLeft, Calendar, Quote } from 'lucide-react';
import { InvestmentJournal } from '../types/investment';

interface MemoListProps {
  journals: InvestmentJournal[];
  onBack: () => void;
  onJournalClick: (journal: InvestmentJournal) => void;
}

export const MemoList: React.FC<MemoListProps> = ({ journals, onBack, onJournalClick }) => {
  // 메모나 시장 이슈가 있는 일지만 필터링
  const memoJournals = journals.filter(j => j.memo || j.marketIssues);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="mb-4 text-slate-400 hover:text-white pl-0"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        돌아가기
      </Button>

      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              투자 메모 전체보기
            </CardTitle>
            <span className="text-sm text-slate-500">
              총 {memoJournals.length}개의 기록
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="divide-y divide-slate-800">
              {memoJournals.length === 0 ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                  </div>
                  <p>작성된 메모가 없습니다.</p>
                </div>
              ) : (
                memoJournals.map((journal) => (
                  <div 
                    key={journal.id} 
                    className="p-6 hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    onClick={() => onJournalClick(journal)}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                        <Calendar className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-slate-300 font-mono text-sm">
                          {new Date(journal.date).toLocaleDateString('ko-KR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric', 
                            weekday: 'long' 
                          })}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors" />
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      {journal.memo && (
                        <div className={`bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 hover:border-blue-500/20 transition-colors ${!journal.marketIssues ? 'md:col-span-2' : ''}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Quote className="h-4 w-4 text-blue-500 opacity-50" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">My Memo</span>
                          </div>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">
                            {journal.memo}
                          </p>
                        </div>
                      )}
                      
                      {journal.marketIssues && (
                        <div className={`bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 hover:border-amber-500/20 transition-colors ${!journal.memo ? 'md:col-span-2' : ''}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Quote className="h-4 w-4 text-amber-500 opacity-50" />
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Market Issues</span>
                          </div>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">
                            {journal.marketIssues}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};