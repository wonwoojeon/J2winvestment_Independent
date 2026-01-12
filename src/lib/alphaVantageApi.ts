// FRED API 연동 라이브러리 (S&P 500)
const BASE_URL = '/api/fred';

const buildFredUrl = (params: Record<string, string>) => {
  const url = new URL(BASE_URL, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const fetchFred = async (url: string) => fetch(url);

const parseFredJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    const preview = text.slice(0, 200);
    throw new Error(`FRED JSON parse failed: ${preview}`);
  }
};

export interface SP500Data {
  date: string;
  close: number;
  change: number;
  changePercent: number;
}

// S&P 500 일일 데이터 가져오기 (SPY ETF 사용)
export const fetchSP500DailyData = async (): Promise<SP500Data[]> => {
  try {
    const response = await fetchFred(
      buildFredUrl({
        series_id: 'SP500',
        observation_start: '2000-01-01',
        sort_order: 'desc',
        limit: '4000',
      })
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await parseFredJson(response);
    
    if (!data.observations) {
      throw new Error('시계열 데이터를 찾을 수 없습니다');
    }
    
    // 데이터를 배열로 변환하고 최근 30개만 가져오기
    const sp500Data: SP500Data[] = [];
    const observations = [...data.observations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (let i = 0; i < Math.min(observations.length, 30); i++) {
      const date = observations[i].date;
      const close = parseFloat(observations[i].value);
      if (Number.isNaN(close)) continue;
      
      let change = 0;
      let changePercent = 0;
      
      // 전일 대비 변화율 계산
      if (i < observations.length - 1) {
        const prevClose = parseFloat(observations[i + 1].value);
        if (!Number.isNaN(prevClose) && prevClose !== 0) {
          change = close - prevClose;
          changePercent = (change / prevClose) * 100;
        }
      }
      
      sp500Data.push({
        date,
        close,
        change,
        changePercent
      });
    }
    
    return sp500Data.reverse(); // 오래된 날짜부터 정렬
  } catch (error) {
    console.error('S&P 500 데이터 가져오기 실패:', error);
    return [];
  }
};

// S&P 500 실시간 가격 가져오기
export const fetchSP500RealTimePrice = async (): Promise<{ price: number; change: number; changePercent: number } | null> => {
  try {
    console.warn('FRED는 실시간 가격 API를 제공하지 않습니다.');
    return null;
  } catch (error) {
    console.error('S&P 500 실시간 가격 가져오기 실패:', error);
    return null;
  }
};

// 월간 S&P 500 데이터 가져오기
export const fetchSP500MonthlyData = async (): Promise<SP500Data[]> => {
  try {
    const response = await fetchFred(
      buildFredUrl({
        series_id: 'SP500',
        frequency: 'monthly',
        aggregation_method: 'avg',
        observation_start: '2000-01-01',
        sort_order: 'desc',
        limit: '400',
      })
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await parseFredJson(response);
    
    if (!data.observations) {
      throw new Error('월간 시계열 데이터를 찾을 수 없습니다');
    }
    
    // 데이터를 배열로 변환하고 최근 12개만 가져오기
    const sp500Data: SP500Data[] = [];
    const observations = [...data.observations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (let i = 0; i < Math.min(observations.length, 12); i++) {
      const date = observations[i].date;
      const close = parseFloat(observations[i].value);
      if (Number.isNaN(close)) continue;
      
      let change = 0;
      let changePercent = 0;
      
      // 전월 대비 변화율 계산
      if (i < observations.length - 1) {
        const prevClose = parseFloat(observations[i + 1].value);
        if (!Number.isNaN(prevClose) && prevClose !== 0) {
          change = close - prevClose;
          changePercent = (change / prevClose) * 100;
        }
      }
      
      sp500Data.push({
        date,
        close,
        change,
        changePercent
      });
    }
    
    return sp500Data.reverse(); // 오래된 날짜부터 정렬
  } catch (error) {
    console.error('S&P 500 월간 데이터 가져오기 실패:', error);
    return [];
  }
};

// API 호출 제한 확인
export const checkApiLimit = async (): Promise<boolean> => {
  try {
    const response = await fetchFred(
      buildFredUrl({ series_id: 'SP500', observation_start: '2000-01-01', limit: '10' })
    );
    return response.ok;
  } catch (error) {
    console.error('API 제한 확인 실패:', error);
    return false;
  }
};
