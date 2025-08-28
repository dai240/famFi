'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { RecurringExpense, Person, Category } from '@/app/page';

interface EditRecurringExpenseModalProps {
  isOpen: boolean;
  expense: RecurringExpense | null;
  onClose: () => void;
  onSave: (expense: RecurringExpense) => void;
  people: Person[];
  categories: Category[];
}

const paymentMethods = ['クレジットカード', '現金', 'デビットカード', '電子マネー', '銀行振込'];

export function EditRecurringExpenseModal({ isOpen, expense, onClose, onSave, people, categories }: EditRecurringExpenseModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    type: 'fixed' as 'fixed' | 'variable',
    amount: '',
    description: '',
    comment: '',
    paymentMethod: 'クレジットカード',
    paidBy: '',
    beneficiaries: [] as string[],
    isActive: true
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        category: expense.category,
        subcategory: expense.subcategory,
        type: expense.type,
        amount: expense.amount?.toString() || '',
        description: expense.description,
        comment: expense.comment || '',
        paymentMethod: expense.paymentMethod,
        paidBy: expense.paidBy,
        beneficiaries: expense.beneficiaries,
        isActive: expense.isActive
      });
    }
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense || !formData.name || !formData.category || !formData.subcategory || !formData.description || !formData.paidBy) {
      return;
    }

    if (formData.type === 'fixed' && !formData.amount) {
      return;
    }

    onSave({
      ...expense,
      name: formData.name,
      category: formData.category,
      subcategory: formData.subcategory,
      type: formData.type,
      amount: formData.type === 'fixed' ? parseInt(formData.amount) : undefined,
      description: formData.description,
      comment: formData.comment || undefined,
      paymentMethod: formData.paymentMethod,
      paidBy: formData.paidBy,
      beneficiaries: formData.beneficiaries,
      isActive: formData.isActive
    });
  };

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      category,
      subcategory: '' // Reset subcategory when category changes
    });
  };

  const handleBeneficiaryChange = (personId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        beneficiaries: [...formData.beneficiaries, personId]
      });
    } else {
      setFormData({
        ...formData,
        beneficiaries: formData.beneficiaries.filter(id => id !== personId)
      });
    }
  };

  const selectedCategory = categories.find(cat => cat.name === formData.category);

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>定期支出を編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">有効/無効</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <div>
            <Label htmlFor="name">支出名</Label>
            <Input
              id="name"
              placeholder="例: 家賃、電気代など"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>支出タイプ</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as 'fixed' | 'variable' })}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed">固定支出（毎月同じ金額）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="variable" id="variable" />
                <Label htmlFor="variable">変動支出（毎月金額が変わる）</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">カテゴリ</Label>
              <Select value={formData.category} onValueChange={handleCategoryChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subcategory">サブカテゴリ</Label>
              <Select 
                value={formData.subcategory} 
                onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                disabled={!formData.category}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategory?.subcategories.map((subcategory) => (
                    <SelectItem key={subcategory} value={subcategory}>
                      {subcategory}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.type === 'fixed' && (
            <div>
              <Label htmlFor="amount">金額</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="description">説明</Label>
            <Input
              id="description"
              placeholder="支出の詳細を入力"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">支払い方法</Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paidBy">支払者</Label>
              <Select value={formData.paidBy} onValueChange={(value) => setFormData({ ...formData, paidBy: value })} required>
                <SelectTrigger>
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
            </div>
          </div>

          <div>
            <Label>受益者（複数選択可）</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
              {people.map((person) => (
                <div key={person.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`beneficiary-${person.id}`}
                    checked={formData.beneficiaries.includes(person.id)}
                    onCheckedChange={(checked) => handleBeneficiaryChange(person.id, checked as boolean)}
                  />
                  <Label htmlFor={`beneficiary-${person.id}`} className="text-sm">
                    {person.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="comment">コメント（任意）</Label>
            <Textarea
              id="comment"
              placeholder="メモやコメントを入力"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" className="flex-1">
              更新
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}