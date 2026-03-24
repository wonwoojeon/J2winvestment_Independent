import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Calculator } from 'lucide-react';
import { Stock } from '@/types/investment';
import { generateId } from '@/lib/storage';
import { fetchStockPrice } from '@/lib/api';
import {
  formatZeroableNumberInput,
  journalFormTone,
  parseNumberInputValue,
} from '@/lib/journalFormFields';
import {
  isAssetPriceLookupSupported,
  normalizeAssetTickerInput,
  shouldAutoFetchAssetPrice,
  type AssetPriceLookupMarket,
} from '@/lib/assetPriceLookup';

interface AssetInputProps {
  title: string;
  stocks: Stock[];
  onStocksChange: (stocks: Stock[]) => void;
  placeholder?: string;
  currency?: string;
  market: AssetPriceLookupMarket;
  journalDate: string;
}

export const AssetInput = ({
  title,
  stocks,
  onStocksChange,
  placeholder = '종목명',
  currency = '',
  market,
  journalDate,
}: AssetInputProps) => {
  const [loading, setLoading] = useState<string | null>(null);
  const symbolSnapshotsRef = useRef<Record<string, string>>({});
  const isLookupSupported = isAssetPriceLookupSupported(market);

  const addStock = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newStock: Stock = {
      id: generateId(),
      symbol: '',
      quantity: 0,
      price: 0,
    };
    onStocksChange([...stocks, newStock]);
  };

  const removeStock = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    onStocksChange(stocks.filter((stock) => stock.id !== id));
  };

  const updateStockFields = (id: string, patch: Partial<Stock>) => {
    onStocksChange(stocks.map((stock) => (stock.id === id ? { ...stock, ...patch } : stock)));
  };

  const updateStock = (id: string, field: keyof Stock, value: string | number) => {
    updateStockFields(id, { [field]: value } as Partial<Stock>);
  };

  const fetchPriceForSymbol = async (id: string, symbol: string) => {
    const normalizedSymbol = normalizeAssetTickerInput(symbol, market);
    if (!normalizedSymbol || !isLookupSupported) return;

    setLoading(id);
    try {
      const price = await fetchStockPrice(normalizedSymbol, {
        date: journalDate,
        market,
      });
      updateStockFields(id, { symbol: normalizedSymbol, price });
    } catch (error) {
      console.error('Failed to fetch price:', error);
    } finally {
      setLoading((current) => (current === id ? null : current));
    }
  };

  const fetchPrice = async (e: React.MouseEvent, id: string, symbol: string) => {
    e.preventDefault();
    e.stopPropagation();
    await fetchPriceForSymbol(id, symbol);
  };

  const handleSymbolBlur = async (stock: Stock) => {
    const previousSymbol = symbolSnapshotsRef.current[stock.id] ?? '';
    delete symbolSnapshotsRef.current[stock.id];

    const normalizedSymbol = normalizeAssetTickerInput(stock.symbol, market);
    if (normalizedSymbol !== stock.symbol) {
      updateStockFields(stock.id, { symbol: normalizedSymbol });
    }

    if (!shouldAutoFetchAssetPrice({
      market,
      previousSymbol,
      nextSymbol: normalizedSymbol,
      currentPrice: stock.price,
    })) {
      return;
    }

    await fetchPriceForSymbol(stock.id, normalizedSymbol);
  };

  return (
    <Card className={journalFormTone.panel}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-slate-900 dark:text-slate-100">{title}</CardTitle>
        <Button
          onClick={addStock}
          type="button"
          size="sm"
          variant="outline"
          className={["gap-1", journalFormTone.outlineButton].join(' ')}
        >
          <Plus className="h-4 w-4" />
          추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {stocks.map((stock) => (
          <div key={stock.id} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Label className={["text-xs", journalFormTone.label].join(' ')}>종목명</Label>
              <Input
                placeholder={placeholder}
                value={stock.symbol}
                onChange={(e) => updateStock(stock.id, 'symbol', e.target.value)}
                onFocus={() => {
                  symbolSnapshotsRef.current[stock.id] = stock.symbol;
                }}
                onBlur={() => {
                  void handleSymbolBlur(stock);
                }}
                className={["text-sm", journalFormTone.input].join(' ')}
              />
            </div>
            <div className="col-span-2">
              <Label className={["text-xs", journalFormTone.label].join(' ')}>수량</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={formatZeroableNumberInput(stock.quantity)}
                onChange={(e) => updateStock(stock.id, 'quantity', parseNumberInputValue(e.target.value))}
                className={["text-sm", journalFormTone.input].join(' ')}
                placeholder="0"
              />
            </div>
            <div className="col-span-3">
              <Label className={["text-xs", journalFormTone.label].join(' ')}>가격{currency}</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={formatZeroableNumberInput(stock.price)}
                  onChange={(e) => updateStock(stock.id, 'price', parseNumberInputValue(e.target.value))}
                  className={["text-sm", journalFormTone.input].join(' ')}
                  placeholder="0"
                />
                <Button
                  onClick={(e) => void fetchPrice(e, stock.id, stock.symbol)}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading === stock.id || !stock.symbol || !isLookupSupported}
                  className={["px-2", journalFormTone.outlineButton].join(' ')}
                  title={isLookupSupported ? '해당 날짜 종가 불러오기' : '현재는 미국주식과 코인만 자동 조회를 지원합니다.'}
                >
                  {loading === stock.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-b border-slate-500 dark:border-slate-300" />
                  ) : (
                    <Calculator className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label className={["text-xs", journalFormTone.label].join(' ')}>평가액</Label>
              <div className={journalFormTone.assetValue}>
                {((stock.price || 0) * stock.quantity).toLocaleString()}
              </div>
            </div>
            <div className="col-span-1">
              <Button
                onClick={(e) => removeStock(e, stock.id)}
                type="button"
                size="sm"
                variant="outline"
                className={["px-2", journalFormTone.outlineButton].join(' ')}
              >
                <Minus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {stocks.length === 0 && (
          <div className={["py-4", "text-center", "text-sm", journalFormTone.helperText].join(' ')}>
            + 버튼을 클릭하여 종목을 추가하세요
          </div>
        )}
        {stocks.length > 0 && (
          <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
            <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
              <span>소계:</span>
              <span>
                {stocks.reduce((sum, stock) => sum + ((stock.price || 0) * stock.quantity), 0).toLocaleString()}
                {currency}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
