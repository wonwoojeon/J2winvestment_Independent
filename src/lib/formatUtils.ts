/**
 * 숫자를 한국어 단위로 포맷팅하는 유틸리티 함수들
 */

/**
 * 원화를 한국어 단위로 포맷팅 (억, 만원 단위)
 * @param amount 금액 (원)
 * @returns 포맷된 문자열 (예: "12억5천만원", "3천500만원", "250만원")
 */
export const formatKoreanCurrency = (amount: number): string => {
  if (amount === 0) return '0원';
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  
  // 억 단위 (100,000,000)
  const eok = Math.floor(absAmount / 100000000);
  const remainder = absAmount % 100000000;
  
  // 천만 단위 (10,000,000)
  const cheonman = Math.floor(remainder / 10000000);
  const remainder2 = remainder % 10000000;
  
  // 만 단위 (10,000)
  const man = Math.floor(remainder2 / 10000);
  
  let result = '';
  
  if (eok > 0) {
    result += `${eok}억`;
    
    if (cheonman > 0) {
      result += `${cheonman}천`;
    }
    
    if (man > 0) {
      result += `${man}만`;
    }
  } else if (cheonman > 0) {
    result += `${cheonman}천`;
    
    if (man > 0) {
      result += `${man}만`;
    }
  } else if (man > 0) {
    result += `${man}만`;
  } else {
    // 만원 미만은 만원 단위로 반올림
    const roundedMan = Math.round(absAmount / 10000);
    if (roundedMan > 0) {
      result += `${roundedMan}만`;
    } else {
      result = '1만'; // 최소 1만원으로 표시
    }
  }
  
  result += '원';
  
  return isNegative ? `-${result}` : result;
};

/**
 * 차트용 간단한 포맷팅 (만원 단위)
 * @param amount 금액 (원)
 * @returns 포맷된 문자열 (예: "1,250만", "35만")
 */
export const formatChartCurrency = (amount: number): string => {
  if (amount === 0) return '0';
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  
  // 억 단위
  if (absAmount >= 100000000) {
    const eok = Math.floor(absAmount / 100000000);
    const remainder = absAmount % 100000000;
    const cheonman = Math.floor(remainder / 10000000);
    
    if (cheonman > 0) {
      return `${isNegative ? '-' : ''}${eok}억${cheonman}천만`;
    } else {
      return `${isNegative ? '-' : ''}${eok}억`;
    }
  }
  
  // 천만 단위
  if (absAmount >= 10000000) {
    const cheonman = Math.floor(absAmount / 10000000);
    const remainder = absAmount % 10000000;
    const man = Math.floor(remainder / 10000);
    
    if (man > 0) {
      return `${isNegative ? '-' : ''}${cheonman}천${man}만`;
    } else {
      return `${isNegative ? '-' : ''}${cheonman}천만`;
    }
  }
  
  // 만 단위
  const man = Math.round(absAmount / 10000);
  return `${isNegative ? '-' : ''}${man}만`;
};

/**
 * 수익률 포맷팅
 * @param percentage 수익률 (%)
 * @returns 포맷된 문자열 (예: "+12.34%", "-5.67%")
 */
export const formatPercentage = (percentage: number): string => {
  if (percentage === 0) return '0.00%';
  
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
};

/**
 * 큰 숫자를 간단하게 표시 (K, M, B 단위)
 * @param num 숫자
 * @returns 포맷된 문자열 (예: "1.25M", "12.5B")
 */
export const formatLargeNumber = (num: number): string => {
  if (Math.abs(num) >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};