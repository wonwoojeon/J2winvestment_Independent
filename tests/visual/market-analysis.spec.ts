import { expect, test, type Page } from '@playwright/test';

const mockReports = [
  {
    id: 'report-2026-03-23',
    report_date: '2026-03-23',
    market_scope: 'us',
    title: '2026-03-23 미국 증시 데일리 분석',
    summary: '대형 기술주가 변동성을 키웠지만, 핵심은 지금이 추격보다 눌림 체크 구간이라는 점입니다.',
    highlights: ['나스닥 약세가 두드러졌습니다.', 'VIX 변동성이 빠르게 확대됐습니다.'],
    tickers: [{
      symbol: 'NVDA',
      name: 'NVIDIA',
      stance: '관심',
      summary: '실적 모멘텀은 유효하지만 추격 매수는 보수적으로 봅니다.',
      adminNote: 'AI 지출 사이클과 실적 민감도가 높은 핵심 관찰 종목입니다.',
      price: 910.12,
      change: -18.45,
      changePercent: -1.99,
      currency: 'USD',
      sessionLabel: '장마감',
      commentary: '반등 추격보다 900달러 지지 여부를 먼저 확인하는 편이 낫습니다.',
      refreshedAt: '2026-03-23T01:47:00.000Z',
      news: [
        {
          title: 'NVIDIA keeps AI demand in focus',
          url: 'https://example.com/nvda-ai-demand',
          source: 'Yahoo Finance',
          publishedAt: '2026-03-23T01:20:00.000Z'
        }
      ]
    }],
    source_name: 'daily_stock_analysis',
    source_url: 'https://example.com/report/2026-03-23',
    raw_payload: {},
    created_at: '2026-03-23T01:47:00.000Z',
    updated_at: '2026-03-23T01:47:00.000Z'
  },
  {
    id: 'report-2026-03-22',
    report_date: '2026-03-22',
    market_scope: 'us',
    title: '2026-03-22 미국 증시 데일리 분석',
    summary:
      '미국 증시는 3대 지수 모두 하락하며 위험회피 심리가 확산되었다. 특히 기술주 중심의 나스닥이 2% 넘게 밀린 가운데, VIX가 11% 이상 급등하며 시장 불안감이 가중되고 있다. 다우지수 상대적 선방은 방어적 성격의 자산 선호 현상을 반영한다.',
    highlights: ['3대 지수 동반 하락', 'VIX 급등으로 방어 심리 강화'],
    tickers: [{ symbol: 'MSFT', name: 'Microsoft', stance: '중립', summary: '지수 하락기 방어력은 있지만 상방 탄력은 확인이 더 필요합니다.' }],
    source_name: 'daily_stock_analysis',
    source_url: 'https://example.com/report/2026-03-22',
    raw_payload: {},
    created_at: '2026-03-22T01:47:00.000Z',
    updated_at: '2026-03-22T01:47:00.000Z'
  },
  {
    id: 'report-2026-03-21',
    report_date: '2026-03-21',
    market_scope: 'us',
    title: '미국 증시 데일리 분석',
    summary: '연준 경로 재평가 구간에서 대형 기술주 중심 상대 강세가 유지됐습니다.',
    highlights: ['대형 기술주 상대 강세'],
    tickers: [],
    source_name: 'daily_stock_analysis',
    source_url: 'https://example.com/report/2026-03-21',
    raw_payload: {},
    created_at: '2026-03-21T01:47:00.000Z',
    updated_at: '2026-03-21T01:47:00.000Z'
  }
];

const mockWatchlist = {
  ok: true,
  items: [
    {
      id: 'watch-1',
      symbol: 'NVDA',
      name: 'NVIDIA',
      stance: '관심',
      summary: 'AI 지출 사이클과 실적 민감도가 높은 핵심 관찰 종목입니다.',
      sortOrder: 10,
      isActive: true,
      createdByEmail: 'admin@example.com',
      createdAt: '2026-03-23T01:47:00.000Z',
      updatedAt: '2026-03-23T01:47:00.000Z'
    }
  ],
  viewer: {
    email: null,
    isAdmin: false
  }
};

const mockAdminEmptyWatchlist = {
  ok: true,
  items: [],
  viewer: {
    email: 'admin@example.com',
    isAdmin: true
  }
};


const mockWatchlistLive = {
  ok: true,
  cached: false,
  refreshedAt: '2026-03-23T01:47:00.000Z',
  items: [
    {
      symbol: 'NVDA',
      name: 'NVIDIA',
      stance: '관심',
      price: 910.12,
      change: -18.45,
      changePercent: -1.99,
      currency: 'USD',
      sessionLabel: '최근 종가',
      commentary: '반등 추격보다 900달러 지지 여부를 먼저 확인하는 편이 낫습니다.',
      refreshedAt: '2026-03-23T01:47:00.000Z',
      news: [
        {
          title: 'NVIDIA keeps AI demand in focus',
          url: 'https://example.com/nvda-ai-demand',
          source: 'Yahoo Finance',
          publishedAt: '2026-03-23T01:20:00.000Z'
        }
      ]
    }
  ]
};

const mockMarketAnalysisFeed = async (
  page: Page,
  watchlist: typeof mockWatchlist | typeof mockAdminEmptyWatchlist = mockWatchlist,
  options?: {
    reports?: typeof mockReports;
    live?: typeof mockWatchlistLive;
  }
) => {
  await page.addInitScript(
    ({ reports, watchlistData, liveData }) => {
      const testWindow = window as Window & {
        __MARKET_ANALYSIS_TEST_ROWS__?: unknown;
        __MARKET_ANALYSIS_TEST_WATCHLIST__?: unknown;
        __MARKET_ANALYSIS_TEST_WATCHLIST_LIVE__?: unknown;
      };

      testWindow.__MARKET_ANALYSIS_TEST_ROWS__ = reports;
      testWindow.__MARKET_ANALYSIS_TEST_WATCHLIST__ = watchlistData;
      testWindow.__MARKET_ANALYSIS_TEST_WATCHLIST_LIVE__ = liveData;
    },
    {
      reports: options?.reports || mockReports,
      watchlistData: watchlist,
      liveData: options?.live,
    }
  );
};

test.describe('Market Analysis Public Entry', () => {
  test('public landing exposes market analysis CTA and route shell', async ({ page }) => {
    await mockMarketAnalysisFeed(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '오늘의 시장분석' })).toBeVisible();
    await page.getByRole('button', { name: '오늘의 시장분석' }).click();

    await expect(page).toHaveURL(/\/market-analysis$/);
    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '운영 상태' }).first()).toBeVisible();
    await expect(page.getByText('상시 추적 종목').first()).toBeVisible();
    await expect(page.getByText('원문 링크 열기')).toHaveCount(0);
    await expect(page.getByText('데이터 파이프라인')).toHaveCount(0);
  });

  test('market analysis history card opens and closes detail dialog', async ({ page }) => {
    await mockMarketAnalysisFeed(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '오늘의 시장분석' }).click();
    await expect(page).toHaveURL(/\/market-analysis$/);
    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByText('2026-03-22 미국 증시 데일리 분석')).toBeVisible();
    await expect(page.getByText('데이터 파이프라인')).toHaveCount(0);

    const moreButton = page.getByRole('button', { name: /전체 내용 보기/i }).first();
    await expect(moreButton).toBeVisible();
    await moreButton.click();
    const historyDialog = page.getByRole('dialog');
    await expect(historyDialog).toBeVisible();
    await expect(historyDialog.getByText('히스토리 상세')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('market analysis renders denser watchlist card without metadata labels', async ({ page }) => {
    await mockMarketAnalysisFeed(page, mockWatchlist, { live: mockWatchlistLive });
    await page.goto('/market-analysis', { waitUntil: 'networkidle' });

    await expect(page.getByText('오늘 볼 종목')).toBeVisible();
    await expect(page.getByText('NVDA')).toBeVisible();
    await expect(page.getByText('NVIDIA', { exact: true })).toBeVisible();
    await expect(page.getByText('$910.12')).toBeVisible();
    await expect(page.getByText('-$18.45')).toBeVisible();
    await expect(page.getByText('-1.99%')).toBeVisible();
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeVisible();
    await expect(page.getByText('관리자 watchlist')).toHaveCount(0);
    await expect(page.getByText('최근 종가')).toHaveCount(0);
    await expect(page.getByText('5분 캐시 시세')).toHaveCount(0);
  });



  test('market analysis renders compact highlight cards and opens detail dialog', async ({ page }) => {
    await mockMarketAnalysisFeed(page, mockWatchlist, {
      reports: [
        {
          ...mockReports[0],
          highlights: [
            'S&P 500은 6500선에서 1.5% 하락하며 지지 테스트를 진행했습니다. 나스닥은 2%대 조정으로 변동성이 더 크게 반응했습니다.',
            '| 지수 | 현재가 | 등락률 | 거래대금 |',
            '|------|------|------|------|',
          ],
        },
        ...mockReports.slice(1),
      ],
    });
    await page.goto('/market-analysis', { waitUntil: 'networkidle' });

    const highlightCard = page.getByRole('button', { name: '핵심 포인트 1 상세 보기' });
    await expect(highlightCard).toBeVisible();
    await expect(page.getByText('POINT 02')).toHaveCount(0);
    await expect(highlightCard.locator('p').first()).toHaveClass(/line-clamp-6/);

    await highlightCard.click();
    const detailDialog = page.getByRole('dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText('핵심 포인트 상세')).toBeVisible();
    await expect(detailDialog.getByText('S&P 500은 6500선에서 1.5% 하락하며 지지 테스트를 진행했습니다.')).toBeVisible();
  });

  test('admin session hides login button and exposes quick add CTA when watchlist is empty', async ({ page }) => {
    await mockMarketAnalysisFeed(page, mockAdminEmptyWatchlist);
    await page.goto('/market-analysis', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '관리자 로그인' })).toHaveCount(0);
    await expect(page.getByText('관리자 세션 · admin@example.com')).toBeVisible();
    await expect(page.getByText('상시 watchlist가 아직 비어 있습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '상시 추적 종목 추가로 이동' })).toBeVisible();
  });
});
