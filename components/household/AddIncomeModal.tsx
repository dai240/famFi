'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AmountInput } from '@/components/household/AmountInput';
import type { Income, Person } from '@/types';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (income: Omit<Income, 'id'>) => void;
  people: Person[];
}

export function AddIncomeModal({ isOpen, onClose, onSave, people }: AddIncomeModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    personId: '',
    comment: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.personId) {
      return;
    }

    onSave({
      date: formData.date,
      amount: parseInt(formData.amount),
      description: formData.description,
      personId: formData.personId,
      comment: formData.comment || undefined
    });

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      personId: '',
      comment: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>入金を追加</DialogTitle>
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

          <div>
            <Label htmlFor="personId">入金者</Label>
            <Select value={formData.personId} onValueChange={(value) => setFormData({ ...formData, personId: value })} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="入金者を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} ({person.group})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">説明</Label>
            <Input
              id="description"
              placeholder="入金の詳細を入力"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="mt-1"
            />
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