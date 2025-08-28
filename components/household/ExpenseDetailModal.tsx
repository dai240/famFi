'use client';

import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Calendar, CreditCard, MessageSquare, User, Users } from 'lucide-react';
import type { Expense, Person } from '@/app/page';

interface ExpenseDetailModalProps {
  isOpen: boolean;
  expense: Expense | null;
  people: Person[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

const categoryColors: Record<string, string> = {
  '住居費': 'bg-blue-100 text-blue-800',
  '食費': 'bg-green-100 text-green-800',
  '育児・教育': 'bg-yellow-100 text-yellow-800',
  '保険・医療': 'bg-red-100 text-red-800',
  'プレゼント・お祝い': 'bg-purple-100 text-purple-800',
  'その他': 'bg-gray-100 text-gray-800',
};

export function ExpenseDetailModal({ isOpen, expense, people, onClose, onEdit, onDelete }: ExpenseDetailModalProps) {
  if (!expense) return null;

  const handleDelete = () => {
    if (confirm('この支出を削除しますか？')) {
      onDelete(expense.id);
    }
  };

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const paidByPerson = people.find(p => p.id === expense.paidBy);
  const beneficiaryNames = expense.beneficiaries.map(id => getPersonName(id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>支出詳細</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Amount */}
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">
              ¥{expense.amount.toLocaleString()}
            </p>
          </div>

          {/* Category and Subcategory */}
          <div className="flex items-center justify-center gap-2">
            <Badge className={categoryColors[expense.category] || 'bg-gray-100 text-gray-800'}>
              {expense.category}
            </Badge>
            <span className="text-sm text-gray-600">
              {expense.subcategory}
            </span>
          </div>

          {/* Description */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {expense.description}
            </h3>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">日付</p>
                <p className="font-medium">
                  {format(new Date(expense.date), 'yyyy年M月d日')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">支払い方法</p>
                <p className="font-medium">{expense.paymentMethod}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">支払者</p>
                <p className="font-medium">{getPersonName(expense.paidBy)}</p>
              </div>
            </div>

            {expense.beneficiaries.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Users className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">受益者</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {beneficiaryNames.map((name, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {expense.comment && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-600">コメント</p>
                  <p className="font-medium text-blue-900">{expense.comment}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onEdit}
              className="flex-1"
            >
              <Edit className="w-4 h-4 mr-2" />
              編集
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}