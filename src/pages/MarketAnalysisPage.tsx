import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  LineChart,
  LockKeyhole,
  Plus,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { createMarketAnalysisEmptyState, mapMarketAnalysisReport, selectPreferredMarketAnalysisReports } from '@/lib/marketAnalysis';
import {
  createMarketAnalysisWatchlistItem,
  deleteMarketAnalysisWatchlistItem,
  fetchMarketAnalysisWatchlist,
  readWatchlistSummary
} from '@/lib/marketAnalysisWatchlist';
import type {
  MarketAnalysisReport,
  MarketAnalysisReportRow,
  MarketAnalysisWatchlistInput,
  MarketAnalysisWatchlistItem
} from '@/types/marketAnalysis';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

const formatDateTime = (value?: string | null) => {
  if (!value) return '아직 없음';

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const buildSignalTone = (report: MarketAnalysisReport | null) => {
  if (!report) {
    return {
      label: '데이터 대기',
      description: '첫 리포트 업로드를 기다리는 중입니다.',
      accent: 'border-white/15 bg-white/6 text-slate-200'
    };
  }

  const watchCount = report.tickers.filter((ticker) => /watch|buy|bull|positive|확대/i.test(ticker.stance || '')).length;
  const cautionCount = report.highlights.filter((item) => /제한|경계|변동성|리스크|부담/i.test(item)).length;

  if (watchCount >= cautionCount) {
    return {
      label: '관심 확장 구간',
      description: '추적 종목 쪽 시그널이 조금 더 강하게 모여 있습니다.',
      accent: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
    };
  }

  return {
    label: '방어 집중 구간',
    description: '핵심 포인트에서 리스크 관리 메시지가 더 우세합니다.',
    accent: 'border-amber-300/25 bg-amber-300/10 text-amber-100'
  };
};

const defaultWatchlistForm = {
  symbol: '',
  name: '',
  stance: '관심',
  summary: '',
  sortOrder: '100'
};

const stanceOptions = ['관심', '중립', '경계'];

const readDisplayTrackedIdeas = (
  latestReport: MarketAnalysisReport | null,
  watchlistItems: MarketAnalysisWatchlistItem[]
) => {
  if (watchlistItems.length > 0) {
    return watchlistItems.map((item) => ({
      key: item.id,
      symbol: item.symbol,
      name: item.name,
      stance: item.stance,
      summary: item.summary,
      source: 'watchlist' as const
    }));
  }

  return (latestReport?.tickers || []).map((ticker, index) => ({
    key: `${ticker.symbol}-${index}`,
    symbol: ticker.symbol,
    name: ticker.name,
    stance: ticker.stance,
    summary: ticker.summary,
    source: 'report' as const
  }));
};

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return '요청을 처리하지 못했습니다.';
};

function MarketAnalysisPage() {
  const [reports, setReports] = useState<MarketAnalysisReport[]>(createMarketAnalysisEmptyState());
  const [loading, setLoading] = useState(true);
  const [watchlistItems, setWatchlistItems] = useState<MarketAnalysisWatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [watchlistForm, setWatchlistForm] = useState(defaultWatchlistForm);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [submittingWatchlist, setSubmittingWatchlist] = useState(false);
  const [deletingWatchlistId, setDeletingWatchlistId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setWatchlistLoading(true);

      const [
        { data, error },
        { data: sessionData }
      ] = await Promise.all([
        supabase
          .from('market_analysis_reports')
          .select('*')
          .eq('market_scope', 'us')
          .order('report_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.auth.getSession()
      ]);

      if (!active) return;

      const accessToken = sessionData.session?.access_token ?? null;
      const sessionEmail = sessionData.session?.user?.email ?? null;
      setViewerEmail(sessionEmail);

      if (error) {
        console.warn('market_analysis_reports read skipped:', error);
        setReports(createMarketAnalysisEmptyState());
      } else {
        const nextReports = selectPreferredMarketAnalysisReports(((data || []) as MarketAnalysisReportRow[]).map(mapMarketAnalysisReport));
        setReports(nextReports);
      }

      try {
        const watchlistResponse = await fetchMarketAnalysisWatchlist(accessToken);
        if (!active) return;

        setWatchlistItems(watchlistResponse.items);
        setIsAdmin(watchlistResponse.viewer.isAdmin);
        setViewerEmail(watchlistResponse.viewer.email ?? sessionEmail);
        setWatchlistError(null);
      } catch (watchlistLoadError) {
        if (!active) return;

        console.warn('market_analysis_watchlist read skipped:', watchlistLoadError);
        setWatchlistItems([]);
        setIsAdmin(false);
        setWatchlistError(readErrorMessage(watchlistLoadError));
      }

      setLoading(false);
      setWatchlistLoading(false);
    };

    loadReports();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      setRefreshTick((current) => current + 1);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshTick]);

  const latestReport = reports[0] ?? null;
  const olderReports = useMemo(() => reports.slice(1), [reports]);
  const latestTimestamp = latestReport?.updatedAt || latestReport?.createdAt || null;
  const signalTone = buildSignalTone(latestReport);
  const watchlistSummary = useMemo(() => readWatchlistSummary(latestReport, watchlistItems), [latestReport, watchlistItems]);
  const trackedIdeas = useMemo(() => readDisplayTrackedIdeas(latestReport, watchlistItems), [latestReport, watchlistItems]);

  const handleAdminLogin = async () => {
    try {
      setAuthBusy(true);
      setAdminNotice(null);
      setWatchlistError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setWatchlistError(readErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleWatchlistFieldChange = (field: keyof typeof defaultWatchlistForm, value: string) => {
    setWatchlistForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleWatchlistCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmittingWatchlist(true);
      setAdminNotice(null);
      setWatchlistError(null);

      const {
        data: { session }
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;
      if (!accessToken) {
        throw new Error('관리자 로그인 후 다시 시도해주세요.');
      }

      const nextItem = await createMarketAnalysisWatchlistItem(
        {
          symbol: watchlistForm.symbol,
          name: watchlistForm.name || undefined,
          stance: watchlistForm.stance || undefined,
          summary: watchlistForm.summary || undefined,
          sortOrder: Number(watchlistForm.sortOrder) || 100
        } satisfies MarketAnalysisWatchlistInput,
        accessToken
      );

      setWatchlistItems((current) => [...current.filter((item) => item.symbol !== nextItem.symbol), nextItem].sort((left, right) => left.sortOrder - right.sortOrder));
      setWatchlistForm(defaultWatchlistForm);
      setAdminNotice(`${nextItem.symbol}를 상시 추적 종목에 추가했습니다.`);
    } catch (error) {
      setWatchlistError(readErrorMessage(error));
    } finally {
      setSubmittingWatchlist(false);
    }
  };

  const handleWatchlistDelete = async (id: string) => {
    try {
      setDeletingWatchlistId(id);
      setAdminNotice(null);
      setWatchlistError(null);

      const {
        data: { session }
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;
      if (!accessToken) {
        throw new Error('관리자 로그인 후 다시 시도해주세요.');
      }

      await deleteMarketAnalysisWatchlistItem(id, accessToken);
      setWatchlistItems((current) => current.filter((item) => item.id !== id));
      setAdminNotice('선택한 추적 종목을 삭제했습니다.');
    } catch (error) {
      setWatchlistError(readErrorMessage(error));
    } finally {
      setDeletingWatchlistId(null);
    }
  };

  const topStats = useMemo(
    () => [
      {
        label: '피드 상태',
        value: latestReport ? 'LIVE' : 'STANDBY',
        detail: latestReport ? '자동 업로드 연결됨' : '첫 업로드 대기'
      },
      {
        label: '최근 보고일',
        value: latestReport ? formatDate(latestReport.reportDate) : '대기 중',
        detail: latestReport ? `${latestReport.marketScope.toUpperCase()} 시장` : '데이터 없음'
      },
      {
        label: '추적 종목',
        value: watchlistSummary.countLabel,
        detail: watchlistSummary.detail
      },
      {
        label: '누적 표시',
        value: `${reports.length}건`,
        detail: reports.length > 1 ? '히스토리 축적 중' : '첫 기록 단계'
      }
    ],
    [latestReport, reports.length, watchlistSummary]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#030712_0%,#0f172a_48%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            {viewerEmail ? (
              <Badge variant="outline" className="border-white/15 bg-white/5 px-3 py-2 text-slate-100">
                {isAdmin ? <ShieldCheck className="mr-2 h-4 w-4 text-emerald-200" /> : <LockKeyhole className="mr-2 h-4 w-4 text-slate-300" />}
                {isAdmin ? `관리자 세션 · ${viewerEmail}` : `읽기 전용 세션 · ${viewerEmail}`}
              </Badge>
            ) : (
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={handleAdminLogin}
                disabled={authBusy}
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                {authBusy ? '로그인 연결 중...' : '관리자 로그인'}
              </Button>
            )}

            <Button
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
              onClick={() => setRefreshTick((current) => current + 1)}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>

        <section className="glass-panel relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),transparent_42%,rgba(16,185,129,0.10))]" />
          <div className="pointer-events-none absolute -right-20 top-8 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-cyan-100/80">
                <Radar className="h-3.5 w-3.5" />
                Market Signal Feed
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold font-display sm:text-5xl">오늘의 시장분석</h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/72 sm:text-base">
                    GitHub Actions에서 생성한 시장 리포트를 모아 보고, 핵심 시그널과 추적 종목을 한 화면에서 읽기 좋게 정리합니다.
                    기록형 일지와 실전 판단 사이를 자연스럽게 이어주는 공개 피드입니다.
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                  공개 피드
                </Badge>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="outline" className={signalTone.accent}>
                  {signalTone.label}
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                  상시 추적 종목
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                  {latestReport ? `${latestReport.sourceName}` : 'daily_stock_analysis 연동 대기'}
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                  마지막 갱신 {formatDateTime(latestTimestamp)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300/68">{signalTone.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {topStats.map((stat) => (
                <div key={stat.label} className="rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.26)] backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400/68">{stat.label}</div>
                  <div className="mt-3 text-lg font-semibold text-white sm:text-xl">{stat.value}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300/62">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
          <section className="space-y-4">
            {loading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-12 text-center text-slate-300/70">
                시장분석을 불러오는 중입니다.
              </div>
            ) : latestReport ? (
              <>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]">
                  <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.58))] p-6 shadow-[0_25px_70px_rgba(2,6,23,0.38)] sm:p-7">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-300/58">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(latestReport.reportDate)}
                      </span>
                      <span className="text-slate-500">/</span>
                      <span>{latestReport.marketScope.toUpperCase()}</span>
                      <span className="text-slate-500">/</span>
                      <span>{latestReport.sourceName}</span>
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">{latestReport.title}</h2>
                    <p className="mt-5 whitespace-pre-line text-sm leading-8 text-slate-200/78 sm:text-base">
                      {latestReport.summary}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-cyan-300/28 bg-cyan-400/10 text-cyan-100">
                        핵심 포인트 {latestReport.highlights.length}개
                      </Badge>
                      <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                        추적 종목 {watchlistSummary.countLabel}
                      </Badge>
                      <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                        {watchlistSummary.detail}
                      </Badge>
                      {latestReport.sourceUrl ? (
                        <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                          원문 링크 제공
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.26)]">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Activity className="h-4 w-4 text-cyan-200" />
                          운영 상태
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm text-slate-300/74">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400/62">마지막 업로드</div>
                          <div className="mt-2 text-base font-medium text-white">{formatDateTime(latestTimestamp)}</div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-400/62">데이터 범위</div>
                            <div className="mt-2 text-base font-medium text-white">{latestReport.marketScope.toUpperCase()} 시장</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-400/62">표시 리포트</div>
                            <div className="mt-2 text-base font-medium text-white">{reports.length}건</div>
                          </div>
                        </div>
                        {latestReport.sourceUrl ? (
                          <Button asChild variant="outline" className="w-full border-white/15 bg-white/6 text-slate-100 hover:bg-white/10">
                            <a href={latestReport.sourceUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              원문 링크 열기
                            </a>
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.22)]">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="h-4 w-4 text-emerald-200" />
                          오늘의 시장 리듬
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm leading-6 text-slate-300/74">
                        <p className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                          {signalTone.description}
                        </p>
                        <p className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                          핵심 포인트와 추적 종목을 함께 보면, 단순 뉴스 요약보다 판단 근거를 더 빨리 읽을 수 있습니다.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.24)]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <LineChart className="h-4 w-4 text-cyan-200" />
                        핵심 포인트
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestReport.highlights.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {latestReport.highlights.map((highlight, index) => (
                            <div key={highlight} className="rounded-[22px] border border-white/10 bg-slate-950/35 px-4 py-4">
                              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/58">Point {String(index + 1).padStart(2, '0')}</div>
                              <p className="mt-3 text-sm leading-7 text-slate-200/78">{highlight}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300/65">핵심 포인트가 아직 등록되지 않았습니다.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.24)]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Radar className="h-4 w-4 text-emerald-200" />
                          추적 종목
                        </CardTitle>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/62">상시 추적 종목</div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
                          {watchlistSummary.usesPersistentWatchlist ? '관리자 watchlist 우선' : '리포트 추적 종목 대체'}
                        </Badge>
                        {watchlistLoading ? (
                          <Badge variant="outline" className="border-white/15 bg-white/7 text-slate-200">
                            watchlist 동기화 중
                          </Badge>
                        ) : null}
                      </div>

                      {watchlistError ? (
                        <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100/88">
                          상시 watchlist를 불러오지 못해 현재는 오늘 리포트 기준으로 표시합니다.
                        </div>
                      ) : null}

                      {trackedIdeas.length > 0 ? (
                        <div className="space-y-3">
                          {trackedIdeas.map((ticker) => (
                            <div key={ticker.key} className="rounded-[22px] border border-white/10 bg-slate-950/35 px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-lg font-semibold text-white">{ticker.symbol}</div>
                                  {ticker.name ? <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400/58">{ticker.name}</div> : null}
                                </div>
                                {ticker.stance ? (
                                  <Badge variant="outline" className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                                    {ticker.stance}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                {ticker.source === 'watchlist' ? '관리자 watchlist' : '오늘 리포트'}
                              </div>
                              {ticker.summary ? <p className="mt-3 text-sm leading-7 text-slate-300/74">{ticker.summary}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300/65">추적 종목이 아직 등록되지 않았습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="rounded-[30px] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center shadow-[0_20px_55px_rgba(2,6,23,0.22)]">
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
            <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.22)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4 text-cyan-200" />
                  운영 상태
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300/74">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">최종 반영 시각</div>
                  <div className="mt-2 text-base font-medium text-white">{formatDateTime(latestTimestamp)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">피드 준비 상태</div>
                  <div className="mt-2 text-base font-medium text-white">{latestReport ? '자동 업로드 정상 연결' : '첫 업로드 대기 중'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">리포트 범위</div>
                  <div className="mt-2 text-base font-medium text-white">{latestReport ? `${latestReport.marketScope.toUpperCase()} / ${reports.length}건` : '데이터 없음'}</div>
                </div>
              </CardContent>
            </Card>

            {isAdmin ? (
              <Card className="border-emerald-300/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(15,23,42,0.72))] text-slate-100 shadow-[0_24px_60px_rgba(2,6,23,0.28)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-emerald-200" />
                    추적 종목 관리
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-slate-300/78">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">관리자 확인</div>
                    <div className="mt-2 font-medium text-white">{viewerEmail || '로그인 계정 확인 중'}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300/68">관리자 이메일 목록과 일치하는 계정만 상시 watchlist를 추가하거나 삭제할 수 있습니다.</p>
                  </div>

                  {adminNotice ? (
                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100/88">
                      {adminNotice}
                    </div>
                  ) : null}

                  {watchlistError ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100/88">
                      {watchlistError}
                    </div>
                  ) : null}

                  <form className="space-y-4" onSubmit={handleWatchlistCreate}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="watchlist-symbol" className="text-slate-200">종목 코드</Label>
                        <Input
                          id="watchlist-symbol"
                          value={watchlistForm.symbol}
                          onChange={(event) => handleWatchlistFieldChange('symbol', event.target.value.toUpperCase())}
                          placeholder="예: NVDA"
                          className="border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="watchlist-name" className="text-slate-200">종목명</Label>
                        <Input
                          id="watchlist-name"
                          value={watchlistForm.name}
                          onChange={(event) => handleWatchlistFieldChange('name', event.target.value)}
                          placeholder="예: NVIDIA"
                          className="border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-200">스탠스</Label>
                      <div className="flex flex-wrap gap-2">
                        {stanceOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleWatchlistFieldChange('stance', option)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${watchlistForm.stance === option ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-slate-950/35 text-slate-300 hover:bg-white/10'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <div className="space-y-2">
                        <Label htmlFor="watchlist-summary" className="text-slate-200">운용 메모</Label>
                        <Textarea
                          id="watchlist-summary"
                          value={watchlistForm.summary}
                          onChange={(event) => handleWatchlistFieldChange('summary', event.target.value)}
                          placeholder="왜 추적하는지, 어떤 조건에서 비중을 보거나 경계할지 짧게 적습니다."
                          className="min-h-[120px] border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="watchlist-order" className="text-slate-200">표시 순서</Label>
                        <Input
                          id="watchlist-order"
                          type="number"
                          min={0}
                          value={watchlistForm.sortOrder}
                          onChange={(event) => handleWatchlistFieldChange('sortOrder', event.target.value)}
                          className="border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" disabled={submittingWatchlist}>
                      <Plus className="mr-2 h-4 w-4" />
                      {submittingWatchlist ? '추가 중...' : '추적 종목 추가'}
                    </Button>
                  </form>

                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">현재 watchlist</div>
                    {watchlistItems.length > 0 ? (
                      watchlistItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{item.symbol}</div>
                              {item.name ? <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400/60">{item.name}</div> : null}
                              {item.summary ? <p className="mt-2 text-sm leading-6 text-slate-300/72">{item.summary}</p> : null}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-slate-300 hover:bg-white/10 hover:text-white"
                              onClick={() => handleWatchlistDelete(item.id)}
                              disabled={deletingWatchlistId === item.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingWatchlistId === item.id ? '삭제 중...' : '삭제'}
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 px-4 py-4 text-sm leading-6 text-slate-300/66">
                        아직 등록된 상시 watchlist가 없습니다.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.22)]">
              <CardHeader>
                <CardTitle className="text-base">최근 히스토리</CardTitle>
              </CardHeader>
              <CardContent>
                {olderReports.length > 0 ? (
                  <div className="space-y-3">
                    {olderReports.map((report, index) => (
                      <div key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-slate-400/55">
                          <span>{formatDate(report.reportDate)}</span>
                          <span>#{String(index + 2).padStart(2, '0')}</span>
                        </div>
                        <div className="mt-2 text-sm font-medium text-white">{report.title}</div>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300/68">{report.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 px-4 py-4 text-sm leading-6 text-slate-300/66">
                    아직 히스토리가 많지 않습니다. 리포트가 누적되면 이 구역에서 흐름 비교가 쉬워집니다.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 text-slate-100 shadow-[0_20px_55px_rgba(2,6,23,0.22)]">
              <CardHeader>
                <CardTitle className="text-base">데이터 파이프라인</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300/72">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">1. 외부 러너가 시장 분석을 생성합니다.</div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">2. `/api/market-analysis-ingest`로 업로드합니다.</div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">3. Supabase에 저장된 결과가 이 페이지에 표시됩니다.</div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default MarketAnalysisPage;
