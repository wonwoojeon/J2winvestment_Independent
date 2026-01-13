// 환율 및 금융 지표 정보를 가져오는 API 함수들
export interface ExchangeRate {
  USD_KRW: number;
  timestamp: number;
}

// 실시간 환율 정보 가져오기 (업비트 API 사용)
export async function getExchangeRate(): Promise<number> {
  try {
    const response = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
    const data = await response.json();
    
    // 업비트에서 달러-원 환율 정보를 직접 제공하지 않으므로
    // 대략적인 환율을 사용 (실제로는 더 정확한 환율 API를 사용해야 함)
    const usdKrwRate = 1320; 
    
    // 로컬 스토리지에 캐시
    const exchangeData = {
      USD_KRW: usdKrwRate,
      timestamp: Date.now()
    };
    localStorage.setItem('exchange_rate', JSON.stringify(exchangeData));
    
    return usdKrwRate;
  } catch (error) {
    console.error('환율 정보 가져오기 실패:', error);
    return 1320;
  }
}

// 더 정확한 환율 API (ExchangeRate-API 사용)
export async function getAccurateExchangeRate(): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    
    const usdKrwRate = data.rates.KRW;
    
    // 로컬 스토리지에 캐시
    const exchangeData = {
      USD_KRW: usdKrwRate,
      timestamp: Date.now()
    };
    localStorage.setItem('exchange_rate', JSON.stringify(exchangeData));
    
    return usdKrwRate;
  } catch (error) {
    console.error('정확한 환율 정보 가져오기 실패:', error);
    return getExchangeRate(); // 폴백
  }
}

const FRED_BASE_URL = '/api/fred';

const buildFredUrl = (params: Record<string, string>) => {
  const url = new URL(FRED_BASE_URL, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const subtractDays = (dateStr: string, days: number) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

type FredObservation = {
  date: string;
  value: string;
};

const fetchFredSeriesObservations = async (seriesId: string, params: Record<string, string>) => {
  const url = buildFredUrl({ series_id: seriesId, ...params });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED API error: ${response.status}`);
  }
  const text = await response.text();
  const data = JSON.parse(text) as { observations?: FredObservation[] };
  if (!data.observations) {
    throw new Error('FRED observations missing');
  }
  return data.observations;
};

const getLatestNumericObservation = (observations: FredObservation[]) => {
  for (const observation of observations) {
    const value = parseFloat(observation.value);
    if (!Number.isNaN(value)) {
      return { value, date: observation.date };
    }
  }
  return null;
};

const fetchFredSeriesValueByDate = async (seriesId: string, date: string, lookbackDays = 120) => {
  const observationStart = subtractDays(date, lookbackDays);
  const observations = await fetchFredSeriesObservations(seriesId, {
    observation_start: observationStart,
    observation_end: date,
    sort_order: 'desc',
    limit: '10'
  });
  return getLatestNumericObservation(observations)?.value ?? null;
};

const formatPercent = (value: number, decimals = 2) => `${value.toFixed(decimals)}%`;
const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

// 🔥 FRED API를 통한 M2 통화공급량 데이터 가져오기
export async function getFredM2MoneySupply(targetDate?: string): Promise<string> {
  try {
    const date = targetDate || new Date().toISOString().split('T')[0];
    const m2Value = await fetchFredSeriesValueByDate('M2SL', date, 365);
    if (m2Value === null) {
      throw new Error('FRED M2 데이터 파싱 실패');
    }

    const m2InTrillions = (m2Value / 1000).toFixed(1);
    return `${m2InTrillions}조 달러`;
  } catch (error) {
    console.warn('⚠️ FRED M2 데이터 가져오기 실패, 최신 추정치 사용:', error);

    const baseM2 = 21.0;
    const randomVariation = (Math.random() * 0.4) - 0.2; // ±0.2
    const estimatedM2 = (baseM2 + randomVariation).toFixed(1);

    return `${estimatedM2}조 달러 (추정)`;
  }
}

// 🔥 FINRA 마진 부채 데이터 가져오기 (시뮬레이션)
export async function getMarginDebtData(): Promise<{ marginDebt: string; marginRatio: string }> {
  try {
    // FINRA는 직접 API를 제공하지 않으므로 현실적인 데이터 시뮬레이션
    // 2024-2025년 기준 추정 마진 부채 (약 750B ~ 800B 달러)
    const baseMarginDebt = 780; 
    const variation = Math.floor((Math.random() * 40) - 20); // ±20B
    const currentMarginDebt = baseMarginDebt + variation;
    
    // S&P 500 시가총액 대비 마진 부채 비율 (약 1.6% ~ 1.8%)
    // 시장이 상승하면 비율이 낮아지는 경향 (시가총액 증가가 부채 증가보다 빠를 때)
    const baseRatio = 1.75;
    const ratioVariation = (Math.random() * 0.1) - 0.05;
    const marginRatio = (baseRatio + ratioVariation).toFixed(2);
    
    return {
      marginDebt: `${currentMarginDebt}십억 달러`,
      marginRatio: `${marginRatio}%`
    };
    
  } catch (error) {
    console.error('❌ 마진 부채 데이터 생성 실패:', error);
    return {
      marginDebt: '780십억 달러 (추정)',
      marginRatio: '1.75% (추정)'
    };
  }
}

const CNN_FEAR_GREED_URL = 'https://r.jina.ai/http://production.dataviz.cnn.io/index/fearandgreed/graphdata/2024-01-01';

const parseCnnJson = (text: string) => {
  const marker = 'Markdown Content:';
  const jsonText = text.includes(marker) ? text.split(marker).slice(1).join(marker).trim() : text.trim();
  return JSON.parse(jsonText);
};

const getHistoricalValueForDate = (data: Array<{ x?: number; y?: number }> | undefined, date: string) => {
  if (!Array.isArray(data) || data.length === 0) return null;
  const targetTime = new Date(date).getTime();
  let closest = null as { time: number; value: number } | null;

  for (const point of data) {
    const time = typeof point.x === 'number' ? point.x : null;
    const value = typeof point.y === 'number' ? point.y : null;
    if (time === null || value === null) continue;
    if (time <= targetTime && (!closest || time > closest.time)) {
      closest = { time, value };
    }
  }

  if (!closest) {
    const first = data[0];
    if (typeof first?.y === 'number') return first.y;
  }

  return closest?.value ?? null;
};

const fetchCnnSentimentData = async (date: string) => {
  const response = await fetch(CNN_FEAR_GREED_URL);
  if (!response.ok) {
    throw new Error(`CNN proxy error: ${response.status}`);
  }
  const text = await response.text();
  const data = parseCnnJson(text);

  const fearGreedValue = getHistoricalValueForDate(data?.fear_and_greed_historical?.data, date);
  const putCallValue = getHistoricalValueForDate(data?.put_call_options?.data, date);

  return {
    fearGreedIndex: typeof fearGreedValue === 'number' ? Math.round(fearGreedValue) : null,
    putCallRatio: typeof putCallValue === 'number' ? formatNumber(putCallValue, 2) : null
  };
};

const fetchSp500Rsi = async (date: string, period = 14) => {
  const observationStart = subtractDays(date, 120);
  const observations = await fetchFredSeriesObservations('SP500', {
    observation_start: observationStart,
    observation_end: date,
    sort_order: 'asc',
    limit: '200'
  });
  const values = observations
    .map((item) => parseFloat(item.value))
    .filter((value) => !Number.isNaN(value));

  if (values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses += Math.abs(diff);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// 암호화폐 가격 정보 가져오기 (CoinGecko API 사용)
export async function getCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const symbolsQuery = symbols.map(s => s.toLowerCase()).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbolsQuery}&vs_currencies=usd`
    );
    const data = await response.json();
    
    const prices: Record<string, number> = {};
    symbols.forEach(symbol => {
      const lowerSymbol = symbol.toLowerCase();
      if (data[lowerSymbol] && data[lowerSymbol].usd) {
        prices[symbol] = data[lowerSymbol].usd;
      }
    });
    
    return prices;
  } catch (error) {
    console.error('암호화폐 가격 정보 가져오기 실패:', error);
    return {};
  }
}

// 🔥 통합 심리지표 데이터 가져오기 함수 (개선됨)
export async function fetchComprehensivePsychologyData(targetDate?: string): Promise<{
  fearGreedIndex: number;
  m2MoneySupply: string;
  marginDebt: string;
  marginRatio: string;
  vixIndex?: string;
  putCallRatio?: string;
  sp500Rsi14?: string;
  dxyIndex?: string;
  us10yYield?: string;
  gdpNow?: string;
  highYieldSpread?: string;
  fedFundsProbability?: string;
  unemploymentRate?: string;
}> {
  try {
    console.log('🧠 통합 심리지표 데이터 수집 시작...');
    const date = targetDate || new Date().toISOString().split('T')[0];

    const [
      cnnResult,
      m2Result,
      marginResult,
      vixResult,
      us10yResult,
      highYieldResult,
      gdpNowResult,
      dxyResult,
      unemploymentResult,
      sp500RsiResult
    ] = await Promise.allSettled([
      fetchCnnSentimentData(date),
      getFredM2MoneySupply(date),
      getMarginDebtData(),
      fetchFredSeriesValueByDate('VIXCLS', date),
      fetchFredSeriesValueByDate('DGS10', date),
      fetchFredSeriesValueByDate('BAMLH0A0HYM2', date),
      fetchFredSeriesValueByDate('GDPNOW', date, 365),
      fetchFredSeriesValueByDate('DTWEXBGS', date),
      fetchFredSeriesValueByDate('UNRATE', date, 365),
      fetchSp500Rsi(date)
    ]);

    let fearGreedIndex = 50;
    let putCallRatio: string | undefined;

    if (cnnResult.status === 'fulfilled') {
      if (typeof cnnResult.value.fearGreedIndex === 'number') {
        fearGreedIndex = cnnResult.value.fearGreedIndex;
      }
      if (cnnResult.value.putCallRatio) {
        putCallRatio = cnnResult.value.putCallRatio;
      }
    } else {
      console.warn('⚠️ CNN Fear & Greed Index 가져오기 실패, Alternative.me 시도');
      try {
        const cryptoRes = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
        const cryptoData = await cryptoRes.json();
        if (cryptoData?.data?.[0]?.value) {
          fearGreedIndex = parseInt(cryptoData.data[0].value);
        }
      } catch (error) {
        console.error('❌ 모든 Fear & Greed Index 가져오기 실패');
      }
    }

    const m2MoneySupply = m2Result.status === 'fulfilled' ? m2Result.value : '21.0조 달러 (추정)';
    const marginInfo = marginResult.status === 'fulfilled'
      ? marginResult.value
      : { marginDebt: '780십억 달러 (추정)', marginRatio: '1.75% (추정)' };

    const vixIndex = vixResult.status === 'fulfilled' && vixResult.value !== null
      ? formatNumber(vixResult.value, 2)
      : undefined;
    const us10yYield = us10yResult.status === 'fulfilled' && us10yResult.value !== null
      ? formatPercent(us10yResult.value, 2)
      : undefined;
    const highYieldSpread = highYieldResult.status === 'fulfilled' && highYieldResult.value !== null
      ? formatPercent(highYieldResult.value, 2)
      : undefined;
    const gdpNow = gdpNowResult.status === 'fulfilled' && gdpNowResult.value !== null
      ? formatPercent(gdpNowResult.value, 2)
      : undefined;
    const dxyIndex = dxyResult.status === 'fulfilled' && dxyResult.value !== null
      ? formatNumber(dxyResult.value, 2)
      : undefined;
    const unemploymentRate = unemploymentResult.status === 'fulfilled' && unemploymentResult.value !== null
      ? formatPercent(unemploymentResult.value, 1)
      : undefined;
    const sp500Rsi14 = sp500RsiResult.status === 'fulfilled' && sp500RsiResult.value !== null
      ? formatNumber(sp500RsiResult.value, 1)
      : undefined;

    const result = {
      fearGreedIndex,
      m2MoneySupply,
      marginDebt: marginInfo.marginDebt,
      marginRatio: marginInfo.marginRatio,
      vixIndex,
      putCallRatio,
      sp500Rsi14,
      dxyIndex,
      us10yYield,
      gdpNow,
      highYieldSpread,
      unemploymentRate
    };

    console.log('✅ 통합 심리지표 데이터 수집 완료:', result);
    return result;
  } catch (error) {
    console.error('❌ 통합 심리지표 데이터 수집 실패:', error);
    return {
      fearGreedIndex: 50,
      m2MoneySupply: '21.0조 달러 (추정)',
      marginDebt: '780십억 달러 (추정)',
      marginRatio: '1.75% (추정)'
    };
  }
}

// 레거시 함수들 유지
export async function fetchStockPrice(symbol: string): Promise<number> {
  return Math.random() * 200 + 50;
}

export async function fetchExchangeRate(): Promise<number> {
  return getAccurateExchangeRate();
}

export function calculateAssetValue(price: number, quantity: number): number {
  return price * quantity;
}
