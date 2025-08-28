'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  quickAmounts?: number[];
}

export function AmountInput({ 
  value, 
  onChange, 
  label, 
  placeholder = "0", 
  className,
  quickAmounts = [1000, 5000, 10000, 20000, 50000, 100000]
}: AmountInputProps) {
  const [customMode, setCustomMode] = useState(false);

  const handleQuickAmount = (amount: number) => {
    const currentValue = parseInt(value) || 0;
    const newValue = currentValue + amount;
    onChange(newValue.toString());
  };

  const handleSubtract = (amount: number) => {
    const currentValue = parseInt(value) || 0;
    const newValue = Math.max(0, currentValue - amount);
    onChange(newValue.toString());
  };

  const handleDirectInput = (inputValue: string) => {
    // Remove non-numeric characters except for empty string
    const numericValue = inputValue.replace(/[^0-9]/g, '');
    onChange(numericValue);
  };

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      
      {/* Current Amount Display */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-sm text-gray-600 mb-1">金額</p>
        <p className="text-2xl font-bold text-gray-900">
          ¥{parseInt(value || '0').toLocaleString()}
        </p>
      </div>

      {/* Quick Amount Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {quickAmounts.map((amount) => (
            <div key={amount} className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSubtract(amount)}
                className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickAmount(amount)}
                className="flex-1 text-sm hover:bg-blue-50 hover:text-blue-700"
              >
                +¥{amount.toLocaleString()}
              </Button>
            </div>
          ))}
        </div>

        {/* Custom Input Toggle */}
        <div className="border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCustomMode(!customMode)}
            className="w-full text-sm text-gray-600"
          >
            {customMode ? '簡単入力に戻る' : '直接入力する'}
          </Button>
          
          {customMode && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => handleDirectInput(e.target.value)}
                className="text-center text-lg"
              />
            </div>
          )}
        </div>

        {/* Clear Button */}
        {parseInt(value || '0') > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange('0')}
            className="w-full text-gray-600 hover:text-gray-700"
          >
            リセット
          </Button>
        )}
      </div>
    </div>
  );
}