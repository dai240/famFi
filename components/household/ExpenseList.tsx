'use client';

import { format, isSameMonth } from 'date-fns';
import { Edit, Eye, Plus, Filter, Check, Clock, X, Grid3X3, Grid2X2, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import type { Expense, Person, Category, RecurringExpense, MonthlyExpenseStatus } from '@/types';
import { AddExpenseModal } from './AddExpenseModal';
import { EditExpenseModal } from './EditExpenseModal';
import { ConfirmExpenseModal } from './ConfirmExpenseModal';
import { ExpenseDetailModal } from './ExpenseDetailModal';

interface ExpenseListProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  monthlyExpenseStatuses: MonthlyExpenseStatus[];
  currentMonth: Date;
  people: Person[];
  categories: Category[];
  onEditExpense: (expense: Expense) => void;
  onViewExpense: (expense: Expense) => void;
  onAddExpense: () => void;
  onToggleRecurringExpenseStatus: (monthlyStatus: MonthlyExpenseStatus) => void;
}

type ViewSize = 'small' | 'medium' | 'large';

export function ExpenseList({
  expenses,
  recurringExpenses,
  monthlyExpenseStatuses,
  currentMonth,
  people,
  categories,
  onEditExpense,
  onViewExpense,
  onAddExpense,
  onToggleRecurringExpenseStatus
}: ExpenseListProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [viewSize, setViewSize] = useState<ViewSize>('medium');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthExpenses = expenses.filter(expense =>
    isSameMonth(new Date(expense.date), currentMonth)
  );

  // Get recurring expenses for current month with their status
  const recurringExpensesWithStatus = recurringExpenses
    .filter(re => re.isActive)
    .map(re => {
      const status = monthlyExpenseStatuses.find(s =>
        s.recurringExpenseId === re.id && s.month === monthKey
      ) || {
        id: `temp-${re.id}`,
        recurringExpenseId: re.id,
        month: monthKey,
        status: 'pending' as const
      };
      return { recurringExpense: re, status };
    });

  // Apply filters to regular expenses
  const filteredRegularExpenses = currentMonthExpenses.filter(expense => {
    const categoryMatch = categoryFilter === 'all' || expense.category === categoryFilter;
    const personMatch = personFilter === 'all' ||
      expense.paidBy === personFilter ||
      expense.beneficiaries.includes(personFilter);
    return categoryMatch && personMatch;
  });

  // Apply filters to recurring expenses
  const filteredRecurringExpenses = recurringExpensesWithStatus.filter(({ recurringExpense }) => {
    const categoryMatch = categoryFilter === 'all' || recurringExpense.category === categoryFilter;
    const personMatch = personFilter === 'all' ||
      recurringExpense.paidBy === personFilter ||
      recurringExpense.beneficiaries.includes(personFilter);
    return categoryMatch && personMatch;
  });

  const totalAmount = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate category totals
  const categoryTotals = currentMonthExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  // Add categories with 0 amount
  categories.forEach(category => {
    if (!categoryTotals[category.name]) {
      categoryTotals[category.name] = 0;
    }
  });

  // Calculate subcategory totals
  const subcategoryTotals = currentMonthExpenses.reduce((acc, expense) => {
    const key = `${expense.category}-${expense.subcategory}`;
    acc[key] = (acc[key] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  const handleToggleStatus = (recurringExpenseWithStatus: { recurringExpense: RecurringExpense, status: MonthlyExpenseStatus }) => {
    onToggleRecurringExpenseStatus(recurringExpenseWithStatus.status);
  };

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    onAddExpense();
    // ここで実際のデータ追加処理を行う
    console.log('新しい支出を追加:', newExpense);
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditModalOpen(true);
  };

  const handleDeleteExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteModalOpen(true);
  };

  const handleSaveExpense = (updatedExpense: Expense) => {
    onEditExpense(updatedExpense);
    setIsEditModalOpen(false);
    setSelectedExpense(null);
  };

  const handleConfirmDelete = () => {
    if (selectedExpense) {
      // ここで実際の削除処理を行う
      console.log('支出を削除:', selectedExpense);
      // onDeleteExpense(selectedExpense.id); // 削除用のコールバックが必要
    }
    setIsDeleteModalOpen(false);
    setSelectedExpense(null);
  };

  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // 表示サイズに基づくスタイル関数
  const getCardPadding = (size: ViewSize) => {
    switch (size) {
      case 'small':
        return 'p-1';
      case 'medium':
        return 'p-3';
      case 'large':
        return 'p-4';
      default:
        return 'p-3';
    }
  };

  const getTextSize = (size: ViewSize) => {
    switch (size) {
      case 'small':
        return 'text-xs';
      case 'medium':
        return 'text-sm';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  // 小サイズ用の簡略化されたカードスタイル
  const getSmallCardStyle = () => {
    return 'max-w-[160px] min-w-[140px]';
  };

  // 小サイズ用の縦余白調整
  const getSmallVerticalSpacing = () => {
    return 'space-y-1'; // 縦の余白を最小限に
  };

  // 小サイズ用の情報表示制御
  const shouldShowDetail = (size: ViewSize) => {
    return size !== 'small'; // 小サイズでは詳細情報を非表示
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <CardTitle className="text-lg md:text-xl mb-2">
                  {format(currentMonth, 'yyyy年M月')}の支出一覧
                </CardTitle>
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-blue-600">確定済み: {currentMonthExpenses.length}件</p>
                      <p className="text-lg md:text-2xl font-bold text-blue-900">
                        ¥{totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-600">合計支出</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={onAddExpense} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                支出を追加
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category Summary */}
          {Object.keys(categoryTotals).length > 0 && (
            <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-3">カテゴリ別合計</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {Object.entries(categoryTotals).map(([category, total]) => {
                  const isExpanded = expandedCategories.has(category);
                  const categorySubcategories = Object.entries(subcategoryTotals)
                    .filter(([key]) => key.startsWith(`${category}-`))
                    .map(([key, amount]) => ({
                      subcategory: key.split('-')[1],
                      amount
                    }));

                  return (
                    <div key={category} className={`rounded border overflow-hidden ${total === 0 ? 'bg-gray-100 border-gray-200' : 'bg-white'}`}>
                      {/* Category Header */}
                      <div
                        className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${total === 0 ? 'hover:bg-gray-150' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleCategoryExpansion(category)}
                      >
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${total === 0 ? 'opacity-50' : ''}`}
                          style={{ backgroundColor: getCategoryColor(category) }}
                        />
                        <span className={`text-xs md:text-sm truncate flex-1 ${total === 0 ? 'text-gray-400' : 'text-gray-600'}`}>{category}</span>
                        <span className={`text-xs md:text-sm font-medium ${total === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                          ¥{total.toLocaleString()}
                        </span>
                        <div className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${total === 0 ? 'text-gray-400' : ''}`}>
                          ▼
                        </div>
                      </div>

                      {/* Subcategory Details */}
                      {isExpanded && categorySubcategories.length > 0 && (
                        <div className="border-t bg-gray-50">
                          {categorySubcategories.map(({ subcategory, amount }) => (
                            <div key={subcategory} className="flex items-center gap-2 p-2 pl-6 text-xs">
                              <span className="text-gray-500">├ {subcategory}</span>
                              <span className="text-gray-700 ml-auto">¥{amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters and View Size */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全てのカテゴリ</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ての人</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Size Selector */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-gray-500 mr-2">表示: {viewSize}</span>
              <Button
                variant={viewSize === 'small' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewSize('small')}
                className="h-8 w-8 p-0"
                title="小サイズ"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewSize === 'medium' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewSize('medium')}
                className="h-8 w-8 p-0"
                title="中サイズ"
              >
                <Grid2X2 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewSize === 'large' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewSize('large')}
                className="h-8 w-8 p-0"
                title="大サイズ"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Add Expense Button */}
            <div className="ml-2">
              <Button onClick={() => setIsAddModalOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                支出を追加
              </Button>
            </div>
          </div>

          {filteredRegularExpenses.length === 0 && filteredRecurringExpenses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4 text-sm md:text-base">
                {currentMonthExpenses.length === 0 && recurringExpensesWithStatus.length === 0
                  ? '今月の支出はまだありません'
                  : 'フィルター条件に一致する支出がありません'
                }
              </p>
              {currentMonthExpenses.length === 0 && recurringExpensesWithStatus.length === 0 && (
                <Button onClick={onAddExpense} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  最初の支出を追加
                </Button>
              )}
            </div>
          ) : (
            <div className={`${
              viewSize === 'small' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2' :
              viewSize === 'medium' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' :
              'grid grid-cols-1 md:grid-cols-2 gap-4'
            }`}>
              {/* Recurring Expenses */}
              {filteredRecurringExpenses.map(({ recurringExpense, status }) => {
                const amount = status.amount || recurringExpense.amount || 0;
                const isConfirmed = status.status === 'confirmed';

                return (
                  <div
                    key={`recurring-${recurringExpense.id}`}
                    className={`${getCardPadding(viewSize)} rounded-lg border transition-colors ${
                      isConfirmed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    } ${viewSize === 'small' ? getSmallCardStyle() : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-1 ${viewSize === 'small' ? 'mb-0.5' : 'mb-2'} flex-wrap`}>
                          <div
                            className={`${viewSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} rounded-full flex-shrink-0`}
                            style={{ backgroundColor: getCategoryColor(recurringExpense.category) }}
                          />
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              backgroundColor: `${getCategoryColor(recurringExpense.category)}20`,
                              borderColor: getCategoryColor(recurringExpense.category),
                              color: getCategoryColor(recurringExpense.category)
                            }}
                          >
                            {recurringExpense.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {recurringExpense.subcategory}
                          </span>
                        </div>

                        <div className={`flex items-center gap-1 ${viewSize === 'small' ? 'mb-0.5' : 'mb-2'} flex-wrap`}>
                          <Badge className={`text-xs ${isConfirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isConfirmed ? (
                              <>
                                <Check className={`${viewSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} mr-1`} />
                                確定済み
                              </>
                            ) : (
                              <>
                                <Clock className={`${viewSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} mr-1`} />
                                確定待ち
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {recurringExpense.type === 'fixed' ? '固定' : '変動'}
                          </Badge>
                        </div>

                        <h3 className={`font-medium text-gray-900 ${viewSize === 'small' ? 'mb-1' : 'mb-2'} text-sm md:text-base`}>{recurringExpense.name}</h3>

                        {shouldShowDetail(viewSize) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                            <div>支払: {getPersonName(recurringExpense.paidBy)}</div>
                            <div>{recurringExpense.paymentMethod}</div>
                            {recurringExpense.beneficiaries.length > 0 && (
                              <div className="col-span-1 sm:col-span-2">
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  受益者: {recurringExpense.beneficiaries.length}人
                                </span>
                              </div>
                            )}
                            {recurringExpense.comment && (
                              <div className="col-span-1 sm:col-span-2">
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  コメントあり
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-gray-900 text-sm md:text-base">
                            {recurringExpense.type === 'fixed'
                              ? `¥${amount.toLocaleString()}`
                              : isConfirmed ? `¥${amount.toLocaleString()}` : '金額未設定'
                            }
                          </p>
                        </div>
                        <Button
                          onClick={() => handleToggleStatus({ recurringExpense, status })}
                          variant={isConfirmed ? "outline" : "default"}
                          size="sm"
                          className={`w-full sm:w-auto ${isConfirmed ? 'border-red-300 text-red-600 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                          {isConfirmed ? (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              解除
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              確定
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Regular Expenses */}
              {filteredRegularExpenses
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((expense) => (
                  <div
                    key={`regular-${expense.id}`}
                    className={`${getCardPadding(viewSize)} bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${viewSize === 'small' ? getSmallCardStyle() : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-1 ${viewSize === 'small' ? 'mb-0.5' : 'mb-2'} flex-wrap`}>
                          <div
                            className={`${viewSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} rounded-full flex-shrink-0`}
                            style={{ backgroundColor: getCategoryColor(expense.category) }}
                          />
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              backgroundColor: `${getCategoryColor(expense.category)}20`,
                              borderColor: getCategoryColor(expense.category),
                              color: getCategoryColor(expense.category)
                            }}
                          >
                            {expense.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {expense.subcategory}
                          </span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <Check className={`${viewSize === 'small' ? 'w-2 h-2' : 'w-3 h-3'} mr-1`} />
                            確定済み
                          </Badge>
                        </div>

                        <h3 className={`font-medium text-gray-900 ${viewSize === 'small' ? 'mb-1' : 'mb-2'} text-sm md:text-base`}>{expense.description}</h3>

                        {shouldShowDetail(viewSize) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                            <div>{format(new Date(expense.date), 'M/d')}</div>
                            <div>支払: {getPersonName(expense.paidBy)}</div>
                            <div>{expense.paymentMethod}</div>
                            {expense.beneficiaries.length > 0 && (
                              <div>
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  受益者: {expense.beneficiaries.length}人
                                </span>
                              </div>
                            )}
                            {expense.comment && (
                              <div className="col-span-1 sm:col-span-2">
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  コメントあり
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-gray-900 text-sm md:text-base">
                            ¥{expense.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewExpense(expense)}
                            className="h-8 w-8 p-0"
                            title="詳細表示"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditExpense(expense)}
                            className="h-8 w-8 p-0"
                            title="編集"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="削除"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddExpense}
        people={people}
        categories={categories}
        currentMonth={currentMonth}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveExpense}
        expense={selectedExpense}
        people={people}
        categories={categories}
      />

      {/* Delete Expense Modal */}
      <ConfirmExpenseModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        expense={selectedExpense}
        people={people}
        categories={categories}
      />

      {/* Detail Expense Modal */}
      <ExpenseDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={handleEditExpense}
        onDelete={handleDeleteExpense}
        expense={selectedExpense}
        people={people}
        categories={categories}
      />
    </div>
  );
}