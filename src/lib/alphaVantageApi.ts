// Alpha Vantage API 연동 라이브러리
const ALPHA_VANTAGE_API_KEY = '9TXNZT3UEY96AJM2';
const BASE_URL = 'https://www.alphavantage.co/query';

export interface SP500Data {
  date: string;
  close: number;
  change: number;
  changePercent: number;
}

// S&P 500 일일 데이터 가져오기 (SPY ETF 사용)
export const fetchSP500DailyData = async (): Promise<SP500Data[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    if (data['Note']) {
      console.warn('API 호출 제한:', data['Note']);
      return [];
    }
    
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error('시계열 데이터를 찾을 수 없습니다');
    }
    
    // 데이터를 배열로 변환하고 최근 30일만 가져오기
    const sp500Data: SP500Data[] = [];
    const dates = Object.keys(timeSeries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    for (let i = 0; i < Math.min(dates.length, 30); i++) {
      const date = dates[i];
      const dayData = timeSeries[date];
      const close = parseFloat(dayData['4. close']);
      
      let change = 0;
      let changePercent = 0;
      
      // 전일 대비 변화율 계산
      if (i < dates.length - 1) {
        const prevDate = dates[i + 1];
        const prevClose = parseFloat(timeSeries[prevDate]['4. close']);
        change = close - prevClose;
        changePercent = (change / prevClose) * 100;
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
    const response = await fetch(
      `${BASE_URL}?function=GLOBAL_QUOTE&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    if (data['Note']) {
      console.warn('API 호출 제한:', data['Note']);
      return null;
    }
    
    const quote = data['Global Quote'];
    if (!quote) {
      throw new Error('실시간 가격 데이터를 찾을 수 없습니다');
    }
    
    return {
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
    };
  } catch (error) {
    console.error('S&P 500 실시간 가격 가져오기 실패:', error);
    return null;
  }
};

// 월간 S&P 500 데이터 가져오기
export const fetchSP500MonthlyData = async (): Promise<SP500Data[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}?function=TIME_SERIES_MONTHLY&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    if (data['Note']) {
      console.warn('API 호출 제한:', data['Note']);
      return [];
    }
    
    const timeSeries = data['Monthly Time Series'];
    if (!timeSeries) {
      throw new Error('월간 시계열 데이터를 찾을 수 없습니다');
    }
    
    // 데이터를 배열로 변환하고 최근 12개월만 가져오기
    const sp500Data: SP500Data[] = [];
    const dates = Object.keys(timeSeries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    for (let i = 0; i < Math.min(dates.length, 12); i++) {
      const date = dates[i];
      const dayData = timeSeries[date];
      const close = parseFloat(dayData['4. close']);
      
      let change = 0;
      let changePercent = 0;
      
      // 전월 대비 변화율 계산
      if (i < dates.length - 1) {
        const prevDate = dates[i + 1];
        const prevClose = parseFloat(timeSeries[prevDate]['4. close']);
        change = close - prevClose;
        changePercent = (change / prevClose) * 100;
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
    const response = await fetch(
      `${BASE_URL}?function=GLOBAL_QUOTE&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data['Note'] && data['Note'].includes('API call frequency')) {
      return false; // API 제한에 걸림
    }
    
    return true; // 정상
  } catch (error) {
    console.error('API 제한 확인 실패:', error);
    return false;
  }
};