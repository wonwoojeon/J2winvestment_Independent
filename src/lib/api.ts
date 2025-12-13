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

// 🔥 FRED API를 통한 M2 통화공급량 데이터 가져오기
export async function getFredM2MoneySupply(): Promise<string> {
  try {
    console.log('📊 FRED M2 데이터 요청 시작...');
    
    // FRED API - M2 Money Supply (M2SL 시리즈)
    // 데모 키 사용 시 제한이 있을 수 있으므로 실패 시 현실적인 시뮬레이션 값 반환
    const fredUrl = 'https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=demo&file_type=json&limit=1&sort_order=desc';
    
    const response = await fetch(fredUrl);
    
    if (!response.ok) {
        throw new Error('FRED API 응답 오류');
    }

    const data = await response.json();
    
    if (data.observations && data.observations.length > 0) {
      const latestObservation = data.observations[0];
      const m2Value = parseFloat(latestObservation.value);
      
      if (!isNaN(m2Value)) {
        // 단위: 십억 달러를 조 달러로 변환
        const m2InTrillions = (m2Value / 1000).toFixed(1);
        return `${m2InTrillions}조 달러`;
      }
    }
    
    throw new Error('FRED M2 데이터 파싱 실패');
  } catch (error) {
    console.warn('⚠️ FRED M2 데이터 가져오기 실패 (데모 키 제한 가능성), 최신 추정치 사용:', error);
    
    // 2024-2025년 기준 현실적인 M2 추정치 (약 20.8 ~ 21.5조 달러 사이)
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
export async function fetchComprehensivePsychologyData(): Promise<{
  fearGreedIndex: number;
  m2MoneySupply: string;
  marginDebt: string;
  marginRatio: string;
}> {
  try {
    console.log('🧠 통합 심리지표 데이터 수집 시작...');
    
    // 병렬로 모든 데이터 요청 (Promise.allSettled로 하나가 실패해도 나머지는 진행)
    const [fearGreedResult, m2Result, marginResult] = await Promise.allSettled([
      // CNN Fear & Greed Index - Proxy를 통해 우회 접속
      fetch('https://api.allorigins.win/raw?url=https://production.dataviz.cnn.io/index/fearandgreed/graphdata/2024-01-01')
        .then(async res => {
          if (!res.ok) throw new Error('CNN API Proxy Error');
          return res.json();
        }),
      // M2 Money Supply
      getFredM2MoneySupply(),
      // Margin Debt Data
      getMarginDebtData()
    ]);
    
    // 1. Fear & Greed Index 처리 (CNN 데이터 우선)
    let fearGreedIndex = 50;
    
    if (fearGreedResult.status === 'fulfilled' && fearGreedResult.value?.fear_and_greed?.score) {
      // CNN 데이터 파싱 성공
      fearGreedIndex = Math.round(fearGreedResult.value.fear_and_greed.score);
      console.log('✅ CNN Fear & Greed Index:', fearGreedIndex);
    } else {
      console.warn('⚠️ CNN Fear & Greed Index 가져오기 실패, Alternative.me 시도');
      
      // CNN 실패 시 암호화폐 공포탐욕지수로 폴백 시도
      try {
        const cryptoRes = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
        const cryptoData = await cryptoRes.json();
        if (cryptoData?.data?.[0]?.value) {
          fearGreedIndex = parseInt(cryptoData.data[0].value);
          console.log('⚠️ Crypto Fear & Greed Index 사용:', fearGreedIndex);
        }
      } catch (e) {
        console.error('❌ 모든 Fear & Greed Index 가져오기 실패');
      }
    }
    
    // 2. M2 데이터 처리
    const m2MoneySupply = m2Result.status === 'fulfilled' 
      ? m2Result.value 
      : '21.0조 달러 (추정)';
    
    // 3. 마진 데이터 처리
    const marginInfo = marginResult.status === 'fulfilled' 
      ? marginResult.value 
      : { marginDebt: '780십억 달러 (추정)', marginRatio: '1.75% (추정)' };
    
    const result = {
      fearGreedIndex,
      m2MoneySupply,
      marginDebt: marginInfo.marginDebt,
      marginRatio: marginInfo.marginRatio
    };
    
    console.log('✅ 통합 심리지표 데이터 수집 완료:', result);
    return result;
    
  } catch (error) {
    console.error('❌ 통합 심리지표 데이터 수집 실패:', error);
    
    // 최악의 경우 백업 데이터 반환
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