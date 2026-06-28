'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
import type { RecurringExpense, Category, Person } from '@/types';

interface RecurringExpenseManagementProps {
  recurringExpenses: RecurringExpense[];
  categories: Category[];
  people: Person[];
  onUpdateRecurringExpenses: (expenses: RecurringExpense[]) => void;
}

export function RecurringExpenseManagement({
  recurringExpenses,
  categories,
  people,
  onUpdateRecurringExpenses
}: RecurringExpenseManagementProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    amount: '',
    type: 'fixed' as 'fixed' | 'variable',
    description: '',
    comment: '',
    personId: ''
  });

  const handleAddExpense = () => {
    const newExpense: RecurringExpense = {
      id: `recurring-${Date.now()}`,
      name: formData.name,
      category: formData.category,
      subcategory: formData.subcategory,
      amount: formData.amount ? parseInt(formData.amount) : undefined,
      type: formData.type,
      description: formData.description,
      comment: formData.comment || undefined,
      personId: formData.personId,
      paymentMethod: 'クレジットカード', // デフォルト値
      paidBy: formData.personId,
      beneficiaries: [formData.personId], // デフォルト値
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    onUpdateRecurringExpenses([...recurringExpenses, newExpense]);
    resetForm();
    setIsAddModalOpen(false);
  };

  const handleEditExpense = () => {
    if (!editingExpense) return;

    const updatedExpense: RecurringExpense = {
      ...editingExpense,
      name: formData.name,
      category: formData.category,
      subcategory: formData.subcategory,
      amount: parseInt(formData.amount) || 0,
      type: formData.type,
      description: formData.description,
      comment: formData.comment || undefined,
      personId: formData.personId,
      updatedAt: new Date()
    };

    const updatedExpenses = recurringExpenses.map(expense => 
      expense.id === editingExpense.id ? updatedExpense : expense
    );

    onUpdateRecurringExpenses(updatedExpenses);
    resetForm();
    setIsEditModalOpen(false);
    setEditingExpense(null);
  };

  const handleDeleteExpense = (expenseId: string) => {
    const updatedExpenses = recurringExpenses.filter(expense => expense.id !== expenseId);
    onUpdateRecurringExpenses(updatedExpenses);
  };

  const handleToggleActive = (expenseId: string) => {
    const updatedExpenses = recurringExpenses.map(expense => 
      expense.id === expenseId 
        ? { ...expense, isActive: !expense.isActive, updatedAt: new Date() }
        : expense
    );
    onUpdateRecurringExpenses(updatedExpenses);
  };

  const openEditModal = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      category: expense.category,
      subcategory: expense.subcategory,
      amount: expense.amount?.toString() || '',
      type: expense.type,
      description: expense.description,
      comment: expense.comment || '',
      personId: expense.personId
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      subcategory: '',
      amount: '',
      type: 'fixed',
      description: '',
      comment: '',
      personId: ''
    });
  };

  const getCategorySubcategories = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.subcategories || [];
  };

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '未設定';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">定期支出管理</h2>
          <p className="text-sm text-gray-600">毎月発生する固定支出を管理します</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          定期支出を追加
        </Button>
      </div>

      <div className="grid gap-4">
        {recurringExpenses.map((expense) => (
          <Card key={expense.id} className={!expense.isActive ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {expense.name}
                    <Badge variant={expense.isActive ? 'default' : 'secondary'}>
                      {expense.isActive ? '有効' : '無効'}
                    </Badge>
                    <Badge variant="outline">
                      {expense.type === 'fixed' ? '固定' : '変動'}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {expense.category} &gt; {expense.subcategory}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(expense.id)}
                  >
                    {expense.isActive ? '無効化' : '有効化'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(expense)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteExpense(expense.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">金額:</span>
                  <span className="ml-2">¥{expense.amount?.toLocaleString() || '未設定'}</span>
                </div>
                <div>
                  <span className="font-medium">支払い者:</span>
                  <span className="ml-2">{getPersonName(expense.personId)}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-medium">説明:</span>
                  <span className="ml-2">{expense.description}</span>
                </div>
                {expense.comment && (
                  <div className="col-span-2">
                    <span className="font-medium">コメント:</span>
                    <span className="ml-2 text-blue-600">{expense.comment}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 追加モーダル */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>定期支出を追加</DialogTitle>
            <DialogDescription>
              毎月発生する固定支出を登録します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">支出名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="家賃"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">カテゴリ</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subcategory">サブカテゴリ</Label>
                <Select value={formData.subcategory} onValueChange={(value) => setFormData({ ...formData, subcategory: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="サブカテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategorySubcategories(formData.category).map((subcategory) => (
                      <SelectItem key={subcategory} value={subcategory}>
                        {subcategory}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">金額</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="type">タイプ</Label>
                <Select value={formData.type} onValueChange={(value: 'fixed' | 'variable') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">固定支出</SelectItem>
                    <SelectItem value="variable">変動支出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="person">支払い者</Label>
              <Select value={formData.personId} onValueChange={(value) => setFormData({ ...formData, personId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="支払い者を選択" />
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
            <div>
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="支出の詳細説明"
              />
            </div>
            <div>
              <Label htmlFor="comment">コメント（任意）</Label>
              <Textarea
                id="comment"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="メモや注意事項"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleAddExpense} className="flex-1" disabled={!formData.name || !formData.category || !formData.amount}>
                <Plus className="w-4 h-4 mr-2" />
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 編集モーダル */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>定期支出を編集</DialogTitle>
            <DialogDescription>
              定期支出の情報を編集します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">支出名</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="家賃"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-category">カテゴリ</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-subcategory">サブカテゴリ</Label>
                <Select value={formData.subcategory} onValueChange={(value) => setFormData({ ...formData, subcategory: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="サブカテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategorySubcategories(formData.category).map((subcategory) => (
                      <SelectItem key={subcategory} value={subcategory}>
                        {subcategory}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-amount">金額</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">タイプ</Label>
                <Select value={formData.type} onValueChange={(value: 'fixed' | 'variable') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">固定支出</SelectItem>
                    <SelectItem value="variable">変動支出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-person">支払い者</Label>
              <Select value={formData.personId} onValueChange={(value) => setFormData({ ...formData, personId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="支払い者を選択" />
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
            <div>
              <Label htmlFor="edit-description">説明</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="支出の詳細説明"
              />
            </div>
            <div>
              <Label htmlFor="edit-comment">コメント（任意）</Label>
              <Textarea
                id="edit-comment"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="メモや注意事項"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleEditExpense} className="flex-1" disabled={!formData.name || !formData.category || !formData.amount}>
                <Check className="w-4 h-4 mr-2" />
                更新
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
