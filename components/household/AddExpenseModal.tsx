'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AmountInput } from '@/components/household/AmountInput';
import type { Expense, Person, Category } from '@/app/page';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => void;
  people: Person[];
  categories: Category[];
}

const paymentMethods = ['クレジットカード', '現金', 'デビットカード', '電子マネー', '銀行振込'];

export function AddExpenseModal({ isOpen, onClose, onSave, people, categories }: AddExpenseModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    subcategory: '',
    description: '',
    comment: '',
    paymentMethod: 'クレジットカード',
    paidBy: '',
    beneficiaries: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.subcategory || !formData.description || !formData.paidBy) {
      return;
    }

    onSave({
      date: formData.date,
      amount: parseInt(formData.amount),
      category: formData.category,
      subcategory: formData.subcategory,
      description: formData.description,
      comment: formData.comment || undefined,
      paymentMethod: formData.paymentMethod,
      paidBy: formData.paidBy,
      beneficiaries: formData.beneficiaries
    });

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      subcategory: '',
      description: '',
      comment: '',
      paymentMethod: 'クレジットカード',
      paidBy: '',
      beneficiaries: []
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>支出を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">日付</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <AmountInput
            label="金額"
            value={formData.amount}
            onChange={(value) => setFormData({ ...formData, amount: value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">カテゴリ</Label>
              <Select value={formData.category} onValueChange={handleCategoryChange} required>
                <SelectTrigger className="mt-1">
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
                <SelectTrigger className="mt-1">
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

          <div>
            <Label htmlFor="description">説明</Label>
            <Input
              id="description"
              placeholder="支出の詳細を入力"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">支払い方法</Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                <SelectTrigger className="mt-1">
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
                <SelectTrigger className="mt-1">
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
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" className="flex-1">
              保存
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}