// 한국어 금액 포맷팅 함수
export const formatKoreanCurrency = (amount: number): string => {
  if (amount === 0) return "0원";
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  
  // 억 단위 (100,000,000)
  const eok = Math.floor(absAmount / 100000000);
  const remainder1 = absAmount % 100000000;
  
  // 천만 단위 (10,000,000)
  const cheonman = Math.floor(remainder1 / 10000000);
  const remainder2 = remainder1 % 10000000;
  
  // 만 단위 (10,000)
  const man = Math.floor(remainder2 / 10000);
  
  let result = "";
  
  if (eok > 0) {
    result += `${eok}억`;
    if (cheonman > 0) {
      result += ` ${cheonman}천만`;
    } else if (man > 0) {
      result += ` ${man}만`;
    }
  } else if (cheonman > 0) {
    result += `${cheonman}천만`;
    if (man > 0) {
      result += ` ${man}만`;
    }
  } else if (man > 0) {
    result += `${man}만`;
  } else {
    const roundedMan = Math.round(absAmount / 10000);
    if (roundedMan > 0) {
      result += `${roundedMan}만`;
    } else {
      result = "1만";
    }
  }
  
  result += "원";
  return isNegative ? `-${result}` : result;
};

// 차트용 축약된 금액 표시
export const formatChartCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  
  if (absAmount >= 100000000) {
    const eokValue = absAmount / 100000000;
    const formatted = eokValue >= 10 ? eokValue.toFixed(0) : eokValue.toFixed(1);
    return `${isNegative ? '-' : ''}${formatted}억`;
  } else if (absAmount >= 10000) {
    const manValue = absAmount / 10000;
    const formatted = manValue >= 10 ? manValue.toFixed(0) : manValue.toFixed(1);
    return `${isNegative ? '-' : ''}${formatted}만`;
  } else {
    return `${isNegative ? '-' : ''}${Math.round(absAmount / 1000)}천`;
  }
};

// 숫자 포맷팅
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// 퍼센트 포맷팅
export const formatPercentage = (num: number, decimals: number = 2): string => {
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`;
};