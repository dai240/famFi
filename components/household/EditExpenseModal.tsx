'use client';

import { useState, useEffect } from 'react';
import { X, Edit, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AmountInput } from './AmountInput';
import type { Expense, Person, Category } from '@/types';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  expense: Expense | null;
  people: Person[];
  categories: Category[];
}

export function EditExpenseModal({
  isOpen,
  onClose,
  onSave,
  expense,
  people,
  categories
}: EditExpenseModalProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    subcategory: '',
    date: '',
    paidBy: '',
    paymentMethod: '',
    beneficiaries: [] as string[],
    comment: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 支出データが変更されたらフォームを更新
  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
        subcategory: expense.subcategory || '',
        date: expense.date,
        paidBy: expense.paidBy,
        paymentMethod: expense.paymentMethod || '',
        beneficiaries: expense.beneficiaries || [],
        comment: expense.comment || ''
      });
      setErrors({});
    }
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!expense) return;

    // バリデーション
    const newErrors: Record<string, string> = {};
    if (!formData.description) newErrors.description = '支出の説明を入力してください';
    if (!formData.amount) newErrors.amount = '金額を入力してください';
    if (!formData.category) newErrors.category = 'カテゴリを選択してください';
    if (!formData.date) newErrors.date = '日付を入力してください';
    if (!formData.paidBy) newErrors.paidBy = '支払者を選択してください';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 更新された支出を作成
    const updatedExpense: Expense = {
      ...expense,
      description: formData.description,
      amount: parseInt(formData.amount),
      category: formData.category,
      subcategory: formData.subcategory || formData.category,
      date: formData.date,
      paidBy: formData.paidBy,
      paymentMethod: formData.paymentMethod || '現金',
      beneficiaries: formData.beneficiaries,
      comment: formData.comment || undefined
    };

    onSave(updatedExpense);
    handleClose();
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const toggleBeneficiary = (personId: string) => {
    setFormData(prev => ({
      ...prev,
      beneficiaries: prev.beneficiaries.includes(personId)
        ? prev.beneficiaries.filter(id => id !== personId)
        : [...prev.beneficiaries, personId]
    }));
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            支出を編集
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 支出の説明 */}
          <div className="space-y-2">
            <Label htmlFor="description">支出の説明 *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="例: 食費、交通費など"
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* 金額 */}
          <div className="space-y-2">
            <AmountInput
              value={formData.amount}
              onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
              label="金額 *"
              className={errors.amount ? 'border-red-500' : ''}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* カテゴリ */}
          <div className="space-y-2">
            <Label htmlFor="category">カテゴリ *</Label>
            <Select value={formData.category} onValueChange={(value) => {
              setFormData(prev => ({
                ...prev,
                category: value,
                subcategory: '' // カテゴリ変更時にサブカテゴリをリセット
              }));
            }}>
              <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-500">{errors.category}</p>
            )}
          </div>

          {/* サブカテゴリ */}
          <div className="space-y-2">
            <Label htmlFor="subcategory">サブカテゴリ</Label>
            <Select
              value={formData.subcategory}
              onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory: value }))}
              disabled={!formData.category}
            >
              <SelectTrigger>
                <SelectValue placeholder="サブカテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {formData.category && categories.find(cat => cat.name === formData.category)?.subcategories?.map((subcategory) => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 日付 */}
          <div className="space-y-2">
            <Label htmlFor="date">日付 *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className={errors.date ? 'border-red-500' : ''}
            />
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date}</p>
            )}
          </div>

          {/* 支払者 */}
          <div className="space-y-2">
            <Label htmlFor="paidBy">支払者 *</Label>
            <Select value={formData.paidBy} onValueChange={(value) => setFormData(prev => ({ ...prev, paidBy: value }))}>
              <SelectTrigger className={errors.paidBy ? 'border-red-500' : ''}>
                <SelectValue placeholder="支払者を選択" />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paidBy && (
              <p className="text-sm text-red-500">{errors.paidBy}</p>
            )}
          </div>

          {/* 支払方法 */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">支払方法</Label>
            <Select value={formData.paymentMethod} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="支払方法を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="現金">現金</SelectItem>
                <SelectItem value="クレジットカード">クレジットカード</SelectItem>
                <SelectItem value="デビットカード">デビットカード</SelectItem>
                <SelectItem value="銀行振込">銀行振込</SelectItem>
                <SelectItem value="電子マネー">電子マネー</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 受益者 */}
          <div className="space-y-2">
            <Label>受益者</Label>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <Badge
                  key={person.id}
                  variant={formData.beneficiaries.includes(person.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleBeneficiary(person.id)}
                >
                  {person.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* コメント */}
          <div className="space-y-2">
            <Label htmlFor="comment">コメント</Label>
            <Textarea
              id="comment"
              value={formData.comment}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              placeholder="特記事項があれば入力してください"
              rows={3}
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              キャンセル
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}