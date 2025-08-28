'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';
import type { MonthlyReflection } from '@/app/page';

interface MonthlyReflectionModalProps {
  isOpen: boolean;
  currentMonth: Date;
  existingReflection?: MonthlyReflection;
  onClose: () => void;
  onSave: (reflection: MonthlyReflection) => void;
}

export function MonthlyReflectionModal({ 
  isOpen, 
  currentMonth, 
  existingReflection, 
  onClose, 
  onSave 
}: MonthlyReflectionModalProps) {
  const [formData, setFormData] = useState({
    reflection: '',
    goals: '',
    improvements: ''
  });

  useEffect(() => {
    if (existingReflection) {
      setFormData({
        reflection: existingReflection.reflection,
        goals: existingReflection.goals,
        improvements: existingReflection.improvements
      });
    } else {
      setFormData({
        reflection: '',
        goals: '',
        improvements: ''
      });
    }
  }, [existingReflection, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    
    onSave({
      month: monthKey,
      reflection: formData.reflection,
      goals: formData.goals,
      improvements: formData.improvements
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {format(currentMonth, 'yyyy年M月')}の振り返り
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="reflection">今月の振り返り</Label>
            <Textarea
              id="reflection"
              placeholder="今月の家計について感じたことや気づいたことを書いてください"
              value={formData.reflection}
              onChange={(e) => setFormData({ ...formData, reflection: e.target.value })}
              rows={4}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="goals">来月の目標</Label>
            <Textarea
              id="goals"
              placeholder="来月に向けての目標や計画を書いてください"
              value={formData.goals}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              rows={3}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="improvements">改善したいこと</Label>
            <Textarea
              id="improvements"
              placeholder="家計管理で改善したいポイントを書いてください"
              value={formData.improvements}
              onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
              rows={3}
              className="mt-2"
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