'use client';

import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Expense, Person, Category, MonthlyExpenseStatus, RecurringExpense } from '@/types';

interface DeleteExpenseConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  expense: Expense | null;
  people: Person[];
  categories: Category[];
  monthlyStatus?: never;
  recurringExpense?: never;
}

interface MonthlyExpenseConfirmProps {
  isOpen: boolean;
  monthlyStatus: MonthlyExpenseStatus | null;
  recurringExpense: RecurringExpense | null;
  onClose: () => void;
  onConfirm: (monthlyStatus: MonthlyExpenseStatus, amount?: number) => void;
  expense?: never;
  people?: never;
  categories?: never;
}

type ConfirmExpenseModalProps = DeleteExpenseConfirmProps | MonthlyExpenseConfirmProps;

export function ConfirmExpenseModal(props: ConfirmExpenseModalProps) {
  if (isDeleteExpenseConfirmProps(props)) {
    return <DeleteExpenseConfirmModal {...props} />;
  }

  return <MonthlyExpenseConfirmModal {...props} />;
}

function isDeleteExpenseConfirmProps(
  props: ConfirmExpenseModalProps
): props is DeleteExpenseConfirmProps {
  return 'expense' in props;
}

function DeleteExpenseConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  expense,
  people,
  categories
}: DeleteExpenseConfirmProps) {
  if (!expense) return null;

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            支出を削除
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              この支出を削除すると、元に戻すことはできません。
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-gray-900">削除対象の支出</h4>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getCategoryColor(expense.category) }}
                />
                <span className="text-gray-600">{expense.category}</span>
                {expense.subcategory && expense.subcategory !== expense.category && (
                  <>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-500">{expense.subcategory}</span>
                  </>
                )}
              </div>

              <div className="font-medium text-gray-900">
                {expense.description}
              </div>

              <div className="text-lg font-bold text-red-600">
                ¥{expense.amount.toLocaleString()}
              </div>

              <div className="text-gray-500">
                {expense.date} - {getPersonName(expense.paidBy)}が支払い
              </div>

              {expense.beneficiaries.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">受益者:</span>
                  <div className="flex flex-wrap gap-1">
                    {expense.beneficiaries.map(personId => (
                      <Badge key={personId} variant="outline" className="text-xs">
                        {getPersonName(personId)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {expense.comment && (
                <div className="text-gray-500">
                  コメント: {expense.comment}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={handleConfirm}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除する
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              キャンセル
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MonthlyExpenseConfirmModal({
  isOpen,
  monthlyStatus,
  recurringExpense,
  onClose,
  onConfirm
}: MonthlyExpenseConfirmProps) {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!recurringExpense || !monthlyStatus) {
      setAmount('');
      return;
    }

    if (recurringExpense.type === 'fixed' && recurringExpense.amount) {
      setAmount(recurringExpense.amount.toString());
    } else if (recurringExpense.type === 'variable' && monthlyStatus.amount) {
      setAmount(monthlyStatus.amount.toString());
    } else {
      setAmount('');
    }
  }, [recurringExpense, monthlyStatus]);

  const handleConfirm = () => {
    if (!monthlyStatus) return;

    const finalAmount = parseInt(amount, 10);
    if (Number.isNaN(finalAmount) || finalAmount <= 0) return;

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
              <div className="flex justify-between gap-4">
                <span>カテゴリ:</span>
                <span className="text-right">{recurringExpense.category} &gt; {recurringExpense.subcategory}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>タイプ:</span>
                <Badge variant="outline">
                  {recurringExpense.type === 'fixed' ? '固定支出' : '変動支出'}
                </Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span>説明:</span>
                <span className="text-right">{recurringExpense.description}</span>
              </div>
              {recurringExpense.comment && (
                <div className="flex justify-between gap-4">
                  <span>コメント:</span>
                  <span className="text-blue-600 text-right">{recurringExpense.comment}</span>
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
              disabled={!amount || parseInt(amount, 10) <= 0}
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
