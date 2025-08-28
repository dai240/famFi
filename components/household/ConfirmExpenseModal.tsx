'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import type { MonthlyExpenseStatus, RecurringExpense } from '@/app/page';

interface ConfirmExpenseModalProps {
  isOpen: boolean;
  monthlyStatus: MonthlyExpenseStatus | null;
  recurringExpense: RecurringExpense | null;
  onClose: () => void;
  onConfirm: (monthlyStatus: MonthlyExpenseStatus, amount?: number) => void;
}

export function ConfirmExpenseModal({ 
  isOpen, 
  monthlyStatus, 
  recurringExpense, 
  onClose, 
  onConfirm 
}: ConfirmExpenseModalProps) {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (recurringExpense && monthlyStatus) {
      if (recurringExpense.type === 'fixed' && recurringExpense.amount) {
        setAmount(recurringExpense.amount.toString());
      } else if (recurringExpense.type === 'variable' && monthlyStatus.amount) {
        setAmount(monthlyStatus.amount.toString());
      } else {
        setAmount('');
      }
    }
  }, [recurringExpense, monthlyStatus]);

  const handleConfirm = () => {
    if (!monthlyStatus) return;
    
    const finalAmount = parseInt(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) return;
    
    onConfirm(monthlyStatus, finalAmount);
  };

  if (!monthlyStatus || !recurringExpense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            支出を確定
          </DialogTitle>
          <DialogDescription>
            定期支出を今月の支出一覧に確定します。金額を確認してから確定してください。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{recurringExpense.name}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>カテゴリ:</span>
                <span>{recurringExpense.category} &gt; {recurringExpense.subcategory}</span>
              </div>
              <div className="flex justify-between">
                <span>タイプ:</span>
                <Badge variant="outline">
                  {recurringExpense.type === 'fixed' ? '固定支出' : '変動支出'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>説明:</span>
                <span>{recurringExpense.description}</span>
              </div>
              {recurringExpense.comment && (
                <div className="flex justify-between">
                  <span>コメント:</span>
                  <span className="text-blue-600">{recurringExpense.comment}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="amount">
              {recurringExpense.type === 'fixed' ? '確定金額' : '今月の金額'}
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={recurringExpense.type === 'fixed'}
              className="mt-2"
            />
            {recurringExpense.type === 'fixed' && (
              <p className="text-xs text-gray-500 mt-1">
                固定支出のため金額は変更できません
              </p>
            )}
            {recurringExpense.type === 'variable' && (
              <p className="text-xs text-gray-500 mt-1">
                今月の実際の金額を入力してください
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              確定すると、この支出が今月の支出一覧に追加されます。
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!amount || parseInt(amount) <= 0}
            >
              <Check className="w-4 h-4 mr-2" />
              確定
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}