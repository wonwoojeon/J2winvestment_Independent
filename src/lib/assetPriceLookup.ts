export type AssetPriceLookupMarket = 'us' | 'kr' | 'crypto';

export interface HistoricalCloseRow {
  date: string;
  close: number;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isAssetPriceLookupSupported = (market: AssetPriceLookupMarket): boolean =>
  market === 'us' || market === 'crypto';

export const normalizeAssetTickerInput = (symbol: string, market: AssetPriceLookupMarket): string => {
  const trimmed = symbol.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();

  if (market === 'crypto') {
    return upper.replace(/[-_/ ]?USD$/, '').replace(/[^A-Z0-9]/g, '');
  }

  return upper;
};

export const normalizeAssetLookupSymbol = (
  symbol: string,
  market: AssetPriceLookupMarket,
): string | null => {
  if (!isAssetPriceLookupSupported(market)) return null;

  const normalized = normalizeAssetTickerInput(symbol, market);
  if (!normalized) return null;

  if (market === 'crypto') {
    return `${normalized.toLowerCase()}usd`;
  }

  return `${normalized.toLowerCase()}.us`;
};

export const selectHistoricalCloseOnOrBeforeDate = (
  rows: HistoricalCloseRow[],
  targetDate: string,
): HistoricalCloseRow | null => {
  if (!datePattern.test(targetDate)) return null;

  const candidates = rows
    .filter((row) => datePattern.test(row.date) && Number.isFinite(row.close))
    .sort((left, right) => left.date.localeCompare(right.date));

  let selected: HistoricalCloseRow | null = null;

  for (const row of candidates) {
    if (row.date > targetDate) {
      break;
    }

    selected = row;
  }

  return selected;
};

export const shouldAutoFetchAssetPrice = ({
  market,
  previousSymbol,
  nextSymbol,
  currentPrice,
}: {
  market: AssetPriceLookupMarket;
  previousSymbol: string;
  nextSymbol: string;
  currentPrice: number;
}): boolean => {
  if (!isAssetPriceLookupSupported(market)) return false;

  const nextNormalized = normalizeAssetTickerInput(nextSymbol, market);
  if (!nextNormalized) return false;

  const previousNormalized = normalizeAssetTickerInput(previousSymbol, market);

  if (currentPrice <= 0) {
    return true;
  }

  return previousNormalized !== nextNormalized;
};
