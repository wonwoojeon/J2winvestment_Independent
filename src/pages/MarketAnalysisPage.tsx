import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Globe2, Radar, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { createMarketAnalysisEmptyState, mapMarketAnalysisReport } from '@/lib/marketAnalysis';
import type { MarketAnalysisReport, MarketAnalysisReportRow } from '@/types/marketAnalysis';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

function MarketAnalysisPage() {
  const [reports, setReports] = useState<MarketAnalysisReport[]>(createMarketAnalysisEmptyState());
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('market_analysis_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8);

      if (!active) return;

      if (error) {
        console.warn('market_analysis_reports read skipped:', error);
        setReports(createMarketAnalysisEmptyState());
        setLoading(false);
        return;
      }

      const nextReports = ((data || []) as MarketAnalysisReportRow[]).map(mapMarketAnalysisReport);
      setReports(nextReports);
      setLoading(false);
    };

    loadReports();

    return () => {
      active = false;
    };
  }, [refreshTick]);

  const latestReport = reports[0] ?? null;
  const olderReports = useMemo(() => reports.slice(1), [reports]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>

          <Button
            variant="outline"
            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
            onClick={() => setRefreshTick((current) => current + 1)}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="glass-panel overflow-hidden p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-cyan-100/80">
                  <Radar className="h-3.5 w-3.5" />
                  Market Signal Feed
                </div>
                <h1 className="text-3xl font-bold font-display sm:text-4xl">오늘의 시장분석</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/70 sm:text-base">
                  GitHub Actions에서 생성한 시장 리포트를 모아 보고, 핵심 시그널과 추적 종목을 한 곳에서 확인합니다.
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                공개 피드
              </Badge>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-10 text-center text-slate-300/70">
                시장분석을 불러오는 중입니다.
              </div>
            ) : latestReport ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-300/55">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(latestReport.reportDate)}
                    </span>
                    <span className="text-slate-500">/</span>
                    <span>{latestReport.marketScope.toUpperCase()}</span>
                    <span className="text-slate-500">/</span>
                    <span>{latestReport.sourceName}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">{latestReport.title}</h2>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-200/78 sm:text-base">
                    {latestReport.summary}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-white/10 bg-white/5 text-slate-100">
                    <CardHeader>
                      <CardTitle className="text-base">핵심 포인트</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestReport.highlights.length > 0 ? (
                        <ul className="space-y-3 text-sm text-slate-200/78">
                          {latestReport.highlights.map((highlight) => (
                            <li key={highlight} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-300/65">핵심 포인트가 아직 등록되지 않았습니다.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/5 text-slate-100">
                    <CardHeader>
                      <CardTitle className="text-base">추적 종목</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestReport.tickers.length > 0 ? (
                        <div className="space-y-3">
                          {latestReport.tickers.map((ticker) => (
                            <div key={`${ticker.symbol}-${ticker.summary || ''}`} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-white">{ticker.symbol}</div>
                                {ticker.stance ? (
                                  <Badge variant="outline" className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                                    {ticker.stance}
                                  </Badge>
                                ) : null}
                              </div>
                              {ticker.summary ? <p className="mt-2 text-sm leading-6 text-slate-300/75">{ticker.summary}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300/65">추적 종목이 아직 등록되지 않았습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-100">
                  <Globe2 className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-semibold text-white">리포트 준비 중</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300/70 sm:text-base">
                  아직 게시된 시장분석이 없습니다.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400/60">
                  첫 리포트가 업로드되면 이 페이지에 자동으로 표시됩니다.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="border-white/10 bg-white/5 text-slate-100">
              <CardHeader>
                <CardTitle className="text-base">최근 히스토리</CardTitle>
              </CardHeader>
              <CardContent>
                {olderReports.length > 0 ? (
                  <div className="space-y-3">
                    {olderReports.map((report) => (
                      <div key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-400/55">{formatDate(report.reportDate)}</div>
                        <div className="mt-2 text-sm font-medium text-white">{report.title}</div>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300/68">{report.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300/65">최근 히스토리가 아직 없습니다.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 text-slate-100">
              <CardHeader>
                <CardTitle className="text-base">수집 구조</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300/72">
                <p>1. 외부 러너가 시장 분석을 생성합니다.</p>
                <p>2. `/api/market-analysis-ingest`로 업로드합니다.</p>
                <p>3. Supabase에 저장된 결과가 이 페이지에 노출됩니다.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default MarketAnalysisPage;
