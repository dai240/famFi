'use client';

import { Eye, Edit, Trash2, Calendar, User, CreditCard, Users, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Expense, Person, Category } from '@/types';

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  expense: Expense | null;
  people: Person[];
  categories: Category[];
}

export function ExpenseDetailModal({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  expense,
  people,
  categories
}: ExpenseDetailModalProps) {
  if (!expense) return null;

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  const handleEdit = () => {
    onEdit(expense);
    onClose();
  };

  const handleDelete = () => {
    onDelete(expense);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            支出の詳細
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ヘッダー情報 */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: getCategoryColor(expense.category) }}
                  />
                  <Badge
                    variant="outline"
                    className="text-sm"
                    style={{
                      backgroundColor: `${getCategoryColor(expense.category)}20`,
                      borderColor: getCategoryColor(expense.category),
                      color: getCategoryColor(expense.category)
                    }}
                  >
                    {expense.category}
                  </Badge>
                  {expense.subcategory && expense.subcategory !== expense.category && (
                    <>
                      <span className="text-gray-400">/</span>
                      <Badge variant="outline" className="text-sm">
                        {expense.subcategory}
                      </Badge>
                    </>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {expense.description}
                </h2>

                <div className="text-3xl font-bold text-blue-600">
                  ¥{expense.amount.toLocaleString()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  削除
                </Button>
              </div>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                基本情報
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">日付</span>
                  <span className="font-medium">{expense.date}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">支払者</span>
                  <span className="font-medium">{getPersonName(expense.paidBy)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">支払方法</span>
                  <span className="font-medium">{expense.paymentMethod || '未設定'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                受益者
              </h3>

              {expense.beneficiaries && expense.beneficiaries.length > 0 ? (
                <div className="space-y-2">
                  {expense.beneficiaries.map(personId => (
                    <Badge key={personId} variant="outline" className="text-sm">
                      {getPersonName(personId)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">受益者が設定されていません</p>
              )}
            </div>
          </div>

          {/* コメント */}
          {expense.comment && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  コメント
                </h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-700">{expense.comment}</p>
                </div>
              </div>
            </>
          )}

          {/* メタ情報 */}
          <Separator />
          <div className="text-xs text-gray-500 text-center">
            <p>ID: {expense.id}</p>
            <p>作成日時: {new Date().toLocaleString('ja-JP')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}