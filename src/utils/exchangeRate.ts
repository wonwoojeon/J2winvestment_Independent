import { InvestmentJournal, Stock } from '@/types/investment';

const sumStocks = (stocks?: Stock[]) =>
  (stocks || []).reduce(
    (sum, stock) => sum + (Number(stock?.price) || 0) * (Number(stock?.quantity) || 0),
    0
  );

const isValidRate = (rate: number) => Number.isFinite(rate) && rate > 0;

export const getJournalExchangeRate = (
  journal: InvestmentJournal | null | undefined,
  fallbackRate = 1300
): number => {
  if (!journal) return fallbackRate;

  const storedRate = Number(journal.exchangeRate);
  if (isValidRate(storedRate)) {
    return storedRate;
  }

  const totalAssets = Number(journal.totalAssets) || 0;
  const usdTotal =
    sumStocks(journal.foreignStocks) +
    sumStocks(journal.cryptocurrency) +
    (Number(journal.cash?.usd) || 0);

  if (totalAssets <= 0 || usdTotal <= 0) {
    return fallbackRate;
  }

  const krwBase = sumStocks(journal.domesticStocks) + (Number(journal.cash?.krw) || 0);
  const impliedRate = (totalAssets - krwBase) / usdTotal;

  if (!isValidRate(impliedRate)) {
    return fallbackRate;
  }

  if (impliedRate < 500 || impliedRate > 3000) {
    return fallbackRate;
  }

  return impliedRate;
};
