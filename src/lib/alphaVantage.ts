// Alpha Vantage API 연동 라이브러리
const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_API_KEY as string | undefined;
const BASE_URL = 'https://www.alphavantage.co/query';

export interface SP500Data {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlphaVantageResponse {
  'Meta Data'?: {
    '1. Information'?: string;
    '2. Symbol'?: string;
    '3. Last Refreshed'?: string;
    '4. Output Size'?: string;
    '5. Time Zone'?: string;
  };
  'Monthly Adjusted Time Series'?: Record<
    string,
    {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. adjusted close'?: string;
      '6. volume': string;
    }
  >;
  'Monthly Time Series'?: Record<
    string,
    {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    }
  >;
  'Error Message'?: string;
  'Note'?: string;
}

/**
 * S&P 500 ETF (SPY) 데이터를 가져옵니다
 */
export const fetchSP500Data = async (_outputSize: 'compact' | 'full' = 'compact'): Promise<SP500Data[]> => {
  try {
    console.log('📊 Alpha Vantage API 호출 시작 - S&P 500 데이터');
    if (!ALPHA_VANTAGE_API_KEY) {
      throw new Error('VITE_ALPHA_API_KEY가 설정되지 않았습니다.');
    }
    const url = `${BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: AlphaVantageResponse = await response.json();
    
    // API 에러 체크
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
    }
    
    if (data['Note']) {
      throw new Error(`Alpha Vantage API Limit: ${data['Note']}`);
    }
    
    const timeSeries = data['Monthly Adjusted Time Series'] || data['Monthly Time Series'];
    if (!timeSeries) {
      throw new Error('Invalid response format from Alpha Vantage API');
    }
    
    // 데이터 변환
    const sp500Data: SP500Data[] = Object.entries(timeSeries)
      .map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['5. adjusted close'] ?? values['4. close']),
        volume: parseInt(values['6. volume'] ?? values['5. volume'])
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // 날짜 오름차순 정렬
    
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
 * API 사용량 체크 (하루 25회 제한)
 */
export const checkAPIUsage = () => {
  const today = new Date().toDateString();
  const usageKey = `alphavantage_usage_${today}`;
  const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
  
  if (currentUsage >= 25) {
    throw new Error('일일 API 사용량 한도 초과 (25회/일)');
  }
  
  localStorage.setItem(usageKey, (currentUsage + 1).toString());
  console.log(`📊 Alpha Vantage API 사용량: ${currentUsage + 1}/25`);
};
