// FRED API 연동 라이브러리 (S&P 500)
const FRED_API_KEY = import.meta.env.VITE_FRED_API_KEY as string | undefined;
const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_PROXY_BASE = 'https://api.allorigins.win/raw?url=';

const buildFredUrl = (params: Record<string, string>) => {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  if (FRED_API_KEY) {
    url.searchParams.set('api_key', FRED_API_KEY);
  }
  url.searchParams.set('file_type', 'json');
  return url.toString();
};

const fetchFred = async (url: string) => {
  const proxiedUrl = `${FRED_PROXY_BASE}${encodeURIComponent(url)}`;
  return fetch(proxiedUrl);
};

const parseFredJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text) as AlphaVantageResponse;
  } catch (error) {
    const preview = text.slice(0, 200);
    throw new Error(`FRED JSON parse failed: ${preview}`);
  }
};

export interface SP500Data {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlphaVantageResponse {
  observations?: Array<{
    date: string;
    value: string;
  }>;
  error_code?: number;
  error_message?: string;
}

/**
 * S&P 500 ETF (SPY) 데이터를 가져옵니다
 */
export const fetchSP500Data = async (_outputSize: 'compact' | 'full' = 'compact'): Promise<SP500Data[]> => {
  try {
    console.log('📊 FRED API 호출 시작 - S&P 500 데이터');
    const url = buildFredUrl({
      series_id: 'SP500',
      observation_start: '2000-01-01',
      sort_order: 'desc',
      limit: '4000',
    });
    const response = await fetchFred(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await parseFredJson(response);
    
    if (data.error_code || data.error_message) {
      throw new Error(`FRED API Error: ${data.error_message || data.error_code}`);
    }
    
    if (!data.observations) {
      throw new Error('Invalid response format from FRED API');
    }
    
    const sp500Data: SP500Data[] = data.observations
      .map((item) => {
        const value = parseFloat(item.value);
        if (Number.isNaN(value)) return null;
        return {
          date: item.date,
          open: value,
          high: value,
          low: value,
          close: value,
          volume: 0
        };
      })
      .filter((item): item is SP500Data => Boolean(item))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log('✅ S&P 500 데이터 로드 완료:', sp500Data.length, '개 데이터');
    console.log('📅 데이터 범위:', sp500Data[0]?.date, '~', sp500Data[sp500Data.length - 1]?.date);
    
    return sp500Data;
    
  } catch (error) {
    console.error('❌ S&P 500 데이터 로드 실패:', error);
    throw error;
  }
};

/**
 * 특정 기간의 S&P 500 수익률을 계산합니다
 */
export const calculateSP500Returns = (data: SP500Data[], startDate: string, endDate: string): number => {
  const startData = data.find(d => d.date >= startDate);
  const endData = data.find(d => d.date >= endDate);
  
  if (!startData || !endData) {
    return 0;
  }
  
  const returnRate = ((endData.close - startData.close) / startData.close) * 100;
  return Math.round(returnRate * 100) / 100; // 소수점 2자리까지
};

/**
 * 최신 S&P 500 가격을 가져옵니다
 */
export const getLatestSP500Price = async (): Promise<number> => {
  try {
    const data = await fetchSP500Data('compact');
    const latestData = data[data.length - 1];
    return latestData.close;
  } catch (error) {
    console.error('❌ 최신 S&P 500 가격 조회 실패:', error);
    return 0;
  }
};

/**
 * FRED는 기본적으로 사용량 제한이 느슨하므로 로컬 제한을 적용하지 않습니다.
 */
export const checkAPIUsage = () => {
  return;
};
