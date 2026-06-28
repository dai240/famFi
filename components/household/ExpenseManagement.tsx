'use client';

import { useState } from 'react';
import { format, isSameMonth } from 'date-fns';
import { Repeat, Plus, Edit, Check, X, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RecurringExpense, MonthlyExpenseStatus, Person, Category } from '@/types';

interface ExpenseManagementProps {
  recurringExpenses: RecurringExpense[];
  monthlyExpenseStatuses: MonthlyExpenseStatus[];
  currentMonth: Date;
  people: Person[];
  categories: Category[];
  onAddRecurringExpense: () => void;
  onEditRecurringExpense: (expense: RecurringExpense) => void;
  onConfirmExpense: (monthlyStatus: MonthlyExpenseStatus) => void;
}

export function ExpenseManagement({
  recurringExpenses,
  monthlyExpenseStatuses,
  currentMonth,
  people,
  categories,
  onAddRecurringExpense,
  onEditRecurringExpense,
  onConfirmExpense
}: ExpenseManagementProps) {
  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  const getMonthlyStatus = (recurringExpenseId: string) => {
    return monthlyExpenseStatuses.find(s => 
      s.recurringExpenseId === recurringExpenseId && s.month === monthKey
    );
  };

  const activeRecurringExpenses = recurringExpenses.filter(e => e.isActive);
  const fixedExpenses = activeRecurringExpenses.filter(e => e.type === 'fixed');
  const variableExpenses = activeRecurringExpenses.filter(e => e.type === 'variable');

  const pendingExpenses = activeRecurringExpenses.filter(expense => {
    const status = getMonthlyStatus(expense.id);
    return !status || status.status === 'pending';
  });

  const confirmedExpenses = activeRecurringExpenses.filter(expense => {
    const status = getMonthlyStatus(expense.id);
    return status && status.status === 'confirmed';
  });

  const getStatusBadge = (expense: RecurringExpense) => {
    const status = getMonthlyStatus(expense.id);
    
    if (!status || status.status === 'pending') {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">
          <Clock className="w-3 h-3 mr-1" />
          確定待ち
        </Badge>
      );
    }
    
    if (status.status === 'confirmed') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
          <Check className="w-3 h-3 mr-1" />
          確定済み
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300 text-xs">
        <X className="w-3 h-3 mr-1" />
        スキップ
      </Badge>
    );
  };

  const handleConfirmExpense = (expense: RecurringExpense) => {
    let status = getMonthlyStatus(expense.id);
    
    if (!status) {
      // Create new status if it doesn't exist
      status = {
        id: Date.now().toString(),
        recurringExpenseId: expense.id,
        month: monthKey,
        status: 'pending'
      };
    }
    
    onConfirmExpense(status);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Repeat className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              支出管理
            </CardTitle>
            <Button onClick={onAddRecurringExpense} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              定期支出を追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="monthly" className="text-xs md:text-sm">今月の確定</TabsTrigger>
              <TabsTrigger value="fixed" className="text-xs md:text-sm">固定支出</TabsTrigger>
              <TabsTrigger value="variable" className="text-xs md:text-sm">変動支出</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    {format(currentMonth, 'yyyy年M月')}の支出確定
                  </span>
                </div>
                <p className="text-xs md:text-sm text-blue-700">
                  定期支出を確認して「確定」ボタンを押すと、実際の支出として記録されます。
                </p>
              </div>

              {pendingExpenses.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">確定待ちの支出</h3>
                  {pendingExpenses.map((expense) => {
                    const status = getMonthlyStatus(expense.id);
                    return (
                      <div key={expense.id} className="p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex flex-col gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: getCategoryColor(expense.category) }}
                              />
                              <h4 className="font-medium text-gray-900 text-sm md:text-base">{expense.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {expense.type === 'fixed' ? '固定' : '変動'}
                              </Badge>
                            </div>
                            <div className="text-xs md:text-sm text-gray-600 space-y-1">
                              <p>{expense.category} &gt; {expense.subcategory}</p>
                              <p>支払者: {getPersonName(expense.paidBy)}</p>
                              {expense.type === 'fixed' && expense.amount && (
                                <p className="font-medium text-gray-900">
                                  金額: ¥{expense.amount.toLocaleString()}
                                </p>
                              )}
                              {expense.type === 'variable' && status?.amount && (
                                <p className="font-medium text-gray-900">
                                  金額: ¥{status.amount.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditRecurringExpense(expense)}
                              className="w-full sm:w-auto"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              編集
                            </Button>
                            <Button
                              onClick={() => handleConfirmExpense(expense)}
                              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                              size="sm"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              確定
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {confirmedExpenses.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">確定済みの支出</h3>
                  {confirmedExpenses.map((expense) => {
                    const status = getMonthlyStatus(expense.id);
                    const amount = status?.amount || expense.amount || 0;
                    return (
                      <div key={expense.id} className="p-3 md:p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: getCategoryColor(expense.category) }}
                              />
                              <h4 className="font-medium text-gray-900 text-sm md:text-base">{expense.name}</h4>
                              <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                                確定済み
                              </Badge>
                            </div>
                            <div className="text-xs md:text-sm text-gray-600 space-y-1">
                              <p>{expense.category} &gt; {expense.subcategory}</p>
                              <p>支払者: {getPersonName(expense.paidBy)}</p>
                              <p className="font-medium text-gray-900">
                                金額: ¥{amount.toLocaleString()}
                              </p>
                              {status?.confirmedDate && (
                                <p>確定日: {format(new Date(status.confirmedDate), 'M/d')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingExpenses.length === 0 && confirmedExpenses.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm md:text-base">今月の定期支出はありません</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="fixed" className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">固定支出一覧</h3>
                  <p className="text-xs md:text-sm text-gray-600">
                    毎月同じ金額で自動的に支出される項目
                  </p>
                </div>
                {fixedExpenses.map((expense) => (
                  <div key={expense.id} className="p-3 md:p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getCategoryColor(expense.category) }}
                          />
                          <h4 className="font-medium text-gray-900 text-sm md:text-base">{expense.name}</h4>
                          {getStatusBadge(expense)}
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 space-y-1">
                          <p>{expense.category} &gt; {expense.subcategory}</p>
                          <p>支払者: {getPersonName(expense.paidBy)}</p>
                          <p className="font-medium text-gray-900">
                            金額: ¥{expense.amount?.toLocaleString()}
                          </p>
                          {expense.comment && (
                            <p className="text-blue-600">{expense.comment}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditRecurringExpense(expense)}
                        className="w-full sm:w-auto"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        編集
                      </Button>
                    </div>
                  </div>
                ))}
                {fixedExpenses.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm md:text-base">固定支出が登録されていません</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="variable" className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">変動支出一覧</h3>
                  <p className="text-xs md:text-sm text-gray-600">
                    毎月金額が変わる項目（確定時に金額を入力）
                  </p>
                </div>
                {variableExpenses.map((expense) => (
                  <div key={expense.id} className="p-3 md:p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getCategoryColor(expense.category) }}
                          />
                          <h4 className="font-medium text-gray-900 text-sm md:text-base">{expense.name}</h4>
                          {getStatusBadge(expense)}
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 space-y-1">
                          <p>{expense.category} &gt; {expense.subcategory}</p>
                          <p>支払者: {getPersonName(expense.paidBy)}</p>
                          <p className="text-gray-500">金額: 毎月入力</p>
                          {expense.comment && (
                            <p className="text-blue-600">{expense.comment}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditRecurringExpense(expense)}
                        className="w-full sm:w-auto"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        編集
                      </Button>
                    </div>
                  </div>
                ))}
                {variableExpenses.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm md:text-base">変動支出が登録されていません</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}