import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Calculator } from 'lucide-react';
import { Stock } from '@/types/investment';
import { generateId } from '@/lib/storage';
import { fetchStockPrice } from '@/lib/api';

interface AssetInputProps {
  title: string;
  stocks: Stock[];
  onStocksChange: (stocks: Stock[]) => void;
  placeholder?: string;
  currency?: string;
}

export const AssetInput = ({ title, stocks, onStocksChange, placeholder = "종목명", currency = "" }: AssetInputProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const addStock = (e: React.MouseEvent) => {
    e.preventDefault(); // form 제출 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    
    const newStock: Stock = {
      id: generateId(),
      symbol: '',
      quantity: 0,
      price: 0,
    };
    onStocksChange([...stocks, newStock]);
  };

  const removeStock = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // form 제출 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    
    onStocksChange(stocks.filter(stock => stock.id !== id));
  };

  const updateStock = (id: string, field: keyof Stock, value: string | number) => {
    onStocksChange(stocks.map(stock => 
      stock.id === id ? { ...stock, [field]: value } : stock
    ));
  };

  const fetchPrice = async (e: React.MouseEvent, id: string, symbol: string) => {
    e.preventDefault(); // form 제출 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    
    if (!symbol) return;
    
    setLoading(id);
    try {
      const price = await fetchStockPrice(symbol.toUpperCase());
      updateStock(id, 'price', price);
    } catch (error) {
      console.error('Failed to fetch price:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button 
          onClick={addStock} 
          type="button"
          size="sm" 
          variant="outline" 
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {stocks.map((stock) => (
          <div key={stock.id} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Label className="text-xs">종목명</Label>
              <Input
                placeholder={placeholder}
                value={stock.symbol}
                onChange={(e) => updateStock(stock.id, 'symbol', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">수량</Label>
              <Input
                type="number"
                value={stock.quantity}
                onChange={(e) => updateStock(stock.id, 'quantity', Number(e.target.value))}
                className="text-sm"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">가격{currency}</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={stock.price || ''}
                  onChange={(e) => updateStock(stock.id, 'price', Number(e.target.value))}
                  className="text-sm"
                  placeholder="0"
                />
                <Button
                  onClick={(e) => fetchPrice(e, stock.id, stock.symbol)}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading === stock.id || !stock.symbol}
                  className="px-2"
                >
                  {loading === stock.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                  ) : (
                    <Calculator className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">평가액</Label>
              <div className="text-sm font-medium bg-gray-50 px-2 py-1 rounded text-right">
                {((stock.price || 0) * stock.quantity).toLocaleString()}
              </div>
            </div>
            <div className="col-span-1">
              <Button
                onClick={(e) => removeStock(e, stock.id)}
                type="button"
                size="sm"
                variant="outline"
                className="px-2"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {stocks.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            + 버튼을 클릭하여 종목을 추가하세요
          </div>
        )}
        {stocks.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center font-semibold">
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