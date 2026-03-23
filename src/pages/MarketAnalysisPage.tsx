import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Globe2,
  LineChart,
  LockKeyhole,
  Plus,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { shouldRefreshMarketAnalysisForAuthEvent } from '@/lib/marketAnalysisAuth';
import { supabase } from '@/lib/supabase';
import { createMarketAnalysisEmptyState, mapMarketAnalysisReport, selectPreferredMarketAnalysisReports } from '@/lib/marketAnalysis';
import {
  createMarketAnalysisWatchlistItem,
  deleteMarketAnalysisWatchlistItem,
  fetchMarketAnalysisWatchlist,
  fetchMarketAnalysisWatchlistLive,
  mergeMarketAnalysisLiveTickers,
  readWatchlistBaseTickers,
  readWatchlistSummary,
  selectActiveMarketAnalysisWatchlist
} from '@/lib/marketAnalysisWatchlist';
import type {
  MarketAnalysisReport,
  MarketAnalysisReportRow,
  MarketAnalysisTicker,
  MarketAnalysisWatchlistInput,
  MarketAnalysisWatchlistItem,
  MarketAnalysisWatchlistLiveResponse
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

const formatCurrency = (value?: number, currency = 'USD') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '시세 대기';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const formatSignedCurrency = (value?: number, currency = 'USD') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(value, currency)}`;
};

const formatSignedPercent = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const readChangeToneClass = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'border-white/10 bg-white/5 text-slate-200';
  }

  if (value > 0) {
    return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
  }

  if (value < 0) {
    return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  }

  return 'border-white/10 bg-white/5 text-slate-200';
};

const defaultWatchlistForm = {
  symbol: '',
  name: '',
  stance: '관심',
  summary: '',
  sortOrder: '100'
};

const stanceOptions = ['관심', '중립', '경계'];
const historyDetailThreshold = 120;

const summarizeHistoryPreview = (summary: string) => summary.replace(/\s+/g, ' ').trim();

const canOpenHistoryDetail = (report: MarketAnalysisReport) => {
  const normalizedSummary = summarizeHistoryPreview(report.summary);
  return normalizedSummary.length > historyDetailThreshold || report.summary.includes('\n');
};

type MarketAnalysisFixtureWindow = Window & {
  __MARKET_ANALYSIS_TEST_ROWS__?: MarketAnalysisReportRow[];
  __MARKET_ANALYSIS_TEST_WATCHLIST__?: {
    items?: MarketAnalysisWatchlistItem[];
    viewer?: {
      email?: string | null;
      isAdmin?: boolean;
    };
  };
  __MARKET_ANALYSIS_TEST_WATCHLIST_LIVE__?: MarketAnalysisWatchlistLiveResponse;
};

type MarketAnalysisDetailState =
  | { kind: 'history'; report: MarketAnalysisReport }
  | { kind: 'highlight'; index: number; content: string };

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return '요청을 처리하지 못했습니다.';
};

const BACKGROUND_VIDEO_URL = '/background.mp4';

const MarketAnalysisBackgroundDecor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = 0.65;
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover opacity-55"
        style={{ filter: 'saturate(1.3) hue-rotate(235deg) brightness(0.38) contrast(1.25)' }}
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={BACKGROUND_VIDEO_URL} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-slate-950/80" />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(88,28,135,0.5), transparent 50%), radial-gradient(circle at 85% 12%, rgba(30,64,175,0.45), transparent 55%), radial-gradient(circle at 75% 85%, rgba(17,24,39,0.8), transparent 55%)'
        }}
      />
      <div className="absolute -top-48 right-[-12%] h-[560px] w-[560px] rounded-full bg-purple-500/20 blur-[170px] mix-blend-screen" />
      <div className="absolute bottom-[-25%] left-[-12%] h-[620px] w-[620px] rounded-full bg-indigo-700/20 blur-[190px] mix-blend-screen" />
    </div>
  );
};

function MarketAnalysisPage() {
  const [reports, setReports] = useState<MarketAnalysisReport[]>(createMarketAnalysisEmptyState());
  const [loading, setLoading] = useState(true);
  const [watchlistItems, setWatchlistItems] = useState<MarketAnalysisWatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [viewerResolved, setViewerResolved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [watchlistForm, setWatchlistForm] = useState(defaultWatchlistForm);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [submittingWatchlist, setSubmittingWatchlist] = useState(false);
  const [deletingWatchlistId, setDeletingWatchlistId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [detailDialogState, setDetailDialogState] = useState<MarketAnalysisDetailState | null>(null);
  const [liveWatchlistTickers, setLiveWatchlistTickers] = useState<MarketAnalysisTicker[]>([]);
  const [liveRefreshLoading, setLiveRefreshLoading] = useState(false);
  const [liveRefreshError, setLiveRefreshError] = useState<string | null>(null);
  const [liveRefreshMeta, setLiveRefreshMeta] = useState<{ cached: boolean; refreshedAt: string | null } | null>(null);
  const adminPanelRef = useRef<HTMLDivElement | null>(null);
  const watchlistSymbolInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setWatchlistLoading(true);

      const fixtureWindow = window as MarketAnalysisFixtureWindow;
      if (Array.isArray(fixtureWindow.__MARKET_ANALYSIS_TEST_ROWS__)) {
        const fixtureReports = selectPreferredMarketAnalysisReports(
          fixtureWindow.__MARKET_ANALYSIS_TEST_ROWS__.map(mapMarketAnalysisReport)
        );
        const fixtureWatchlist = fixtureWindow.__MARKET_ANALYSIS_TEST_WATCHLIST__;

        setReports(fixtureReports);
        setWatchlistItems(selectActiveMarketAnalysisWatchlist(fixtureWatchlist?.items || []));
        setIsAdmin(Boolean(fixtureWatchlist?.viewer?.isAdmin));
        setViewerEmail(fixtureWatchlist?.viewer?.email ?? null);
        setViewerResolved(true);
        setWatchlistError(null);
        setLoading(false);
        setWatchlistLoading(false);
        return;
      }

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
      } finally {
        if (!active) return;

        setViewerResolved(true);
        setLoading(false);
        setWatchlistLoading(false);
      }
    };

    void loadReports();

    return () => {
      active = false;
    };
  }, [reloadVersion]);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefreshMarketAnalysisForAuthEvent(event)) return;
      setViewerResolved(false);
      setReloadVersion((current) => current + 1);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const latestReport = reports[0] ?? null;
  const olderReports = useMemo(() => reports.slice(1), [reports]);
  const latestHighlights = latestReport?.highlights ?? [];
  const latestTimestamp = latestReport?.updatedAt || latestReport?.createdAt || null;
  const watchlistSummary = useMemo(() => readWatchlistSummary(latestReport, watchlistItems), [latestReport, watchlistItems]);
  const baseTrackedIdeas = useMemo(() => readWatchlistBaseTickers(latestReport, watchlistItems), [latestReport, watchlistItems]);
  const trackedIdeas = useMemo(
    () => mergeMarketAnalysisLiveTickers(baseTrackedIdeas, liveWatchlistTickers),
    [baseTrackedIdeas, liveWatchlistTickers]
  );

  useEffect(() => {
    let active = true;
    const fixtureWindow = window as MarketAnalysisFixtureWindow;

    const applyLivePayload = (payload: MarketAnalysisWatchlistLiveResponse) => {
      setLiveWatchlistTickers(payload.items || []);
      setLiveRefreshMeta({
        cached: payload.cached,
        refreshedAt: payload.refreshedAt ?? null
      });
      setLiveRefreshError(null);
    };

    const loadLiveWatchlist = async () => {
      if (watchlistItems.length === 0) {
        setLiveWatchlistTickers([]);
        setLiveRefreshMeta(null);
        setLiveRefreshError(null);
        setLiveRefreshLoading(false);
        return;
      }

      if (fixtureWindow.__MARKET_ANALYSIS_TEST_WATCHLIST_LIVE__) {
        applyLivePayload(fixtureWindow.__MARKET_ANALYSIS_TEST_WATCHLIST_LIVE__);
        return;
      }

      if (Array.isArray(fixtureWindow.__MARKET_ANALYSIS_TEST_ROWS__)) {
        setLiveWatchlistTickers([]);
        setLiveRefreshMeta(null);
        setLiveRefreshError(null);
        setLiveRefreshLoading(false);
        return;
      }

      try {
        setLiveRefreshLoading(true);
        const payload = await fetchMarketAnalysisWatchlistLive();
        if (!active) return;
        applyLivePayload(payload);
      } catch {
        if (!active) return;
        setLiveRefreshError('실시간 시세를 불러오지 못해 리포트 기준 정보로 표시합니다.');
      } finally {
        if (!active) return;
        setLiveRefreshLoading(false);
      }
    };

    void loadLiveWatchlist();

    return () => {
      active = false;
    };
  }, [watchlistItems]);

  const handleLiveWatchlistRefresh = async () => {
    try {
      setLiveRefreshLoading(true);
      setLiveRefreshError(null);

      const payload = await fetchMarketAnalysisWatchlistLive();
      setLiveWatchlistTickers(payload.items || []);
      setLiveRefreshMeta({
        cached: payload.cached,
        refreshedAt: payload.refreshedAt ?? null
      });
    } catch {
      setLiveRefreshError('실시간 시세를 갱신하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLiveRefreshLoading(false);
    }
  };

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

  const handleAdminWatchlistShortcut = () => {
    setAdminPanelOpen(true);
    adminPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      watchlistSymbolInputRef.current?.focus();
    }, 180);
  };

  return (
    <Dialog open={Boolean(detailDialogState)} onOpenChange={(open) => !open && setDetailDialogState(null)}>
      <div className="relative min-h-screen text-slate-100 font-sans selection:bg-cyan-400/30">
      <MarketAnalysisBackgroundDecor />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            {!viewerResolved ? (
              <Badge variant="outline" className="border-white/15 bg-white/5 px-3 py-2 text-slate-300">
                세션 확인 중...
              </Badge>
            ) : viewerEmail ? (
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
                onClick={() => setReloadVersion((current) => current + 1)}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                피드 새로고침
              </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <section className="space-y-4">
            {loading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-12 text-center text-slate-300/70">
                시장분석을 불러오는 중입니다.
              </div>
            ) : latestReport ? (
              <>
                <div className="glass-panel rounded-[32px] bg-slate-950/48 p-6 shadow-[0_32px_80px_-44px_rgba(15,23,42,0.95)] sm:p-8">
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
                    <div className="mt-6 max-w-4xl">
                      <h2 className="mt-4 break-keep text-[2rem] font-semibold leading-[1.08] text-white sm:text-[2.6rem] xl:text-[3rem]">{latestReport.title}</h2>
                      <p className="mt-6 whitespace-pre-line break-keep text-[0.98rem] leading-8 text-slate-200/84 sm:text-[1.03rem] sm:leading-[2rem]">
                        {latestReport.summary}
                      </p>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <Card className="bg-slate-950/46 text-slate-100 shadow-[0_24px_65px_-38px_rgba(15,23,42,0.95)]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                          <LineChart className="h-4 w-4 text-cyan-200" />
                          핵심 포인트
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestHighlights.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {latestHighlights.map((highlight, index) => (
                            <button
                              key={`${index}-${highlight}`}
                              type="button"
                              aria-label={`핵심 포인트 ${index + 1} 상세 보기`}
                              onClick={() => setDetailDialogState({ kind: 'highlight', index, content: highlight })}
                              className="flex min-h-[198px] h-full flex-col rounded-[22px] border border-white/10 bg-slate-950/58 px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/20"
                            >
                              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/58">Point {String(index + 1).padStart(2, '0')}</div>
                              <p className="mt-3 line-clamp-6 break-keep text-[0.95rem] leading-[1.8] text-slate-100/82">{highlight}</p>
                              <div className="mt-auto pt-4">
                                <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-200/72">
                                  전체 보기
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300/65">핵심 포인트가 아직 등록되지 않았습니다.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-950/46 text-slate-100 shadow-[0_24px_65px_-38px_rgba(15,23,42,0.95)]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Radar className="h-4 w-4 text-emerald-200" />
                          오늘 볼 종목
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {watchlistSummary.usesPersistentWatchlist ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                              onClick={handleLiveWatchlistRefresh}
                              disabled={liveRefreshLoading || watchlistLoading}
                              title={liveRefreshMeta?.refreshedAt ? `최근 갱신 ${formatDateTime(liveRefreshMeta.refreshedAt)}` : undefined}
                            >
                              <RefreshCcw className={`mr-2 h-4 w-4 ${liveRefreshLoading ? 'animate-spin' : ''}`} />
                              새로고침
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                              onClick={handleAdminWatchlistShortcut}
                              aria-label="상시 추적 종목 추가로 이동"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {watchlistError ? (
                        <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100/88">
                          상시 watchlist를 불러오지 못해 현재는 오늘 리포트 기준으로 표시합니다.
                        </div>
                      ) : null}

                      {liveRefreshError ? (
                        <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100/88">
                          {liveRefreshError}
                        </div>
                      ) : null}

                      {isAdmin && !watchlistSummary.usesPersistentWatchlist ? (
                        <div className="mb-4 rounded-2xl border border-emerald-300/18 bg-emerald-400/8 px-4 py-3 text-sm leading-6 text-emerald-100/88">
                          상시 watchlist가 아직 비어 있습니다. 오른쪽 관리자 패널 또는 위 + 버튼으로 바로 추가할 수 있습니다.
                        </div>
                      ) : null}

                      {trackedIdeas.length > 0 ? (
                        <div className="space-y-3">
                          {trackedIdeas.map((ticker) => (
                            <div key={ticker.symbol} className="rounded-[22px] border border-white/10 bg-slate-950/58 px-4 py-3.5 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.95)]">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[1.8rem] font-semibold leading-none text-white">{ticker.symbol}</div>
                                  {ticker.name ? <div className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-400/58">{ticker.name}</div> : null}
                                </div>
                                <div className="flex flex-col items-end gap-3 text-right">
                                  {ticker.stance ? (
                                    <Badge variant="outline" className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                                      {ticker.stance}
                                    </Badge>
                                  ) : null}
                                  <div>
                                    <div className="text-[2rem] font-semibold text-white sm:text-[2.05rem]">
                                      {formatCurrency(ticker.price, ticker.currency || 'USD')}
                                    </div>
                                    {formatSignedPercent(ticker.changePercent) ? (
                                      <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${readChangeToneClass(ticker.changePercent)}`}>
                                        <span>{formatSignedCurrency(ticker.change, ticker.currency || 'USD')}</span>
                                        <span>{formatSignedPercent(ticker.changePercent)}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {ticker.commentary ? (
                                <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3">
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/60">AI 한줄 판단</div>
                                  <p className="mt-3 break-keep text-[0.94rem] leading-7 text-slate-100/88">{ticker.commentary}</p>
                                </div>
                              ) : null}

                              {ticker.adminNote ? (
                                <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3">
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/60">관리자 메모</div>
                                  <p className="mt-3 break-keep text-[0.94rem] leading-7 text-slate-300/78">{ticker.adminNote}</p>
                                </div>
                              ) : null}

                              {!ticker.commentary && ticker.summary ? (
                                <p className="mt-4 break-keep text-[0.94rem] leading-7 text-slate-300/78">{ticker.summary}</p>
                              ) : null}

                              {ticker.news && ticker.news.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400/60">관련 뉴스</div>
                                  {ticker.news.slice(0, 2).map((news) => (
                                    <a
                                      key={`${ticker.symbol}-${news.url}`}
                                      href={news.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3 transition hover:border-white/20 hover:bg-white/[0.06]"
                                    >
                                      <div className="break-keep text-sm font-medium leading-6 text-white">{news.title}</div>
                                      <div className="mt-2 text-xs text-slate-400/70">
                                        {news.source || '출처 없음'}
                                        {news.publishedAt ? ` · ${formatDateTime(news.publishedAt)}` : ''}
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-300/65">추적 종목이 아직 등록되지 않았습니다.</p>
                          {isAdmin ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10"
                              onClick={handleAdminWatchlistShortcut}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              상시 추적 종목 추가
                            </Button>
                          ) : null}
                        </div>
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

            <Card className="bg-slate-950/46 text-slate-100 shadow-[0_24px_65px_-38px_rgba(15,23,42,0.95)]">
              <CardHeader>
                <CardTitle className="text-base">최근 히스토리</CardTitle>
              </CardHeader>
              <CardContent>
                {olderReports.length > 0 ? (
                  <div className="space-y-3">
                    {olderReports.map((report, index) => {
                      const isExpandable = canOpenHistoryDetail(report);
                      const previewText = summarizeHistoryPreview(report.summary);

                      if (isExpandable) {
                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => setDetailDialogState({ kind: 'history', report })}
                            aria-label={`${report.title} 전체 내용 보기`}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/58 px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/20"
                          >
                            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-slate-400/55">
                              <span>{formatDate(report.reportDate)}</span>
                              <span>#{String(index + 2).padStart(2, '0')}</span>
                            </div>
                            <div className="mt-2 text-sm font-medium text-white">{report.title}</div>
                            <p className="mt-2 line-clamp-3 break-keep text-[0.94rem] leading-6 text-slate-300/74">{previewText}</p>
                            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-200/72">
                              전체 내용 보기
                            </div>
                          </button>
                        );
                      }

                      return (
                        <div key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/58 px-4 py-4">
                          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-slate-400/55">
                            <span>{formatDate(report.reportDate)}</span>
                            <span>#{String(index + 2).padStart(2, '0')}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-white">{report.title}</div>
                          <p className="mt-2 break-keep text-[0.94rem] leading-6 text-slate-300/74">{previewText}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 px-4 py-4 text-sm leading-6 text-slate-300/66">
                    아직 히스토리가 많지 않습니다. 리포트가 누적되면 이 구역에서 흐름 비교가 쉬워집니다.
                  </div>
                )}
              </CardContent>
            </Card>

            {isAdmin ? (
              <div ref={adminPanelRef}>
              <Collapsible open={adminPanelOpen} onOpenChange={setAdminPanelOpen}>
              <Card className="bg-slate-950/5 text-slate-100 shadow-[0_26px_70px_-42px_rgba(15,23,42,0.95)]">
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={adminPanelOpen ? '추적 종목 관리 접기' : '추적 종목 관리 펼치기'}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck className="h-4 w-4 text-emerald-200" />
                        추적 종목 관리
                      </CardTitle>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {adminPanelOpen ? '접기' : '펼치기'}
                        <ChevronDown className={`h-4 w-4 transition ${adminPanelOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/58 px-4 py-3 text-sm leading-6 text-slate-300/78">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400/58">관리자 확인</div>
                    <div className="mt-2 font-medium text-white">{viewerEmail || '로그인 계정 확인 중'}</div>
                    <p className="mt-2 break-keep text-sm leading-6 text-slate-300/74">관리자 이메일 목록과 일치하는 계정만 상시 watchlist를 추가하거나 삭제할 수 있습니다.</p>
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
                          ref={watchlistSymbolInputRef}
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
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-black/70 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{item.symbol}</div>
                              {item.name ? <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400/60">{item.name}</div> : null}
                              {item.summary ? <p className="mt-2 break-keep text-sm leading-6 text-slate-300/76">{item.summary}</p> : null}
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
                </CollapsibleContent>
              </Card>
              </Collapsible>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
      </div>

      <DialogContent
        aria-label={detailDialogState?.kind === 'highlight' ? '핵심 포인트 상세' : '히스토리 상세'}
        aria-describedby={undefined}
        className="max-w-3xl border border-white/10 bg-slate-950/88 px-6 py-6 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-7"
      >
        {detailDialogState?.kind === 'history' ? (
          <>
            <DialogHeader className="space-y-3 text-left">
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400/70">히스토리 상세</div>
              <DialogTitle className="text-2xl font-semibold leading-tight text-white">
                {detailDialogState.report.title}
              </DialogTitle>
              <div className="text-sm text-slate-400">
                {formatDate(detailDialogState.report.reportDate)} · {detailDialogState.report.marketScope.toUpperCase()} 시장
              </div>
            </DialogHeader>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-5 break-keep text-[0.98rem] leading-8 text-slate-200/84">
              {detailDialogState.report.summary}
            </div>
          </>
        ) : detailDialogState?.kind === 'highlight' ? (
          <>
            <DialogHeader className="space-y-3 text-left">
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400/70">핵심 포인트 상세</div>
              <DialogTitle className="text-2xl font-semibold leading-tight text-white">
                Point {String(detailDialogState.index + 1).padStart(2, '0')}
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-5 break-keep text-[0.98rem] leading-8 text-slate-200/84">
              {detailDialogState.content}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default MarketAnalysisPage;
