'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Person } from '@/app/page';

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: Omit<Person, 'id'>) => void;
}

const groups = ['家族', '友人', '会社', '親戚', 'その他'];

export function AddPersonModal({ isOpen, onClose, onSave }: AddPersonModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    birthday: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.group) {
      return;
    }

    onSave({
      name: formData.name,
      group: formData.group,
      birthday: formData.birthday || undefined,
      notes: formData.notes || undefined
    });

    // Reset form
    setFormData({
      name: '',
      group: '',
      birthday: '',
      notes: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>人を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">名前</Label>
            <Input
              id="name"
              placeholder="名前を入力"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="group">グループ</Label>
            <Select value={formData.group} onValueChange={(value) => setFormData({ ...formData, group: value })} required>
              <SelectTrigger>
                <SelectValue placeholder="グループを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="birthday">誕生日（任意）</Label>
            <Input
              id="birthday"
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="notes">メモ（任意）</Label>
            <Textarea
              id="notes"
              placeholder="メモやコメントを入力"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
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