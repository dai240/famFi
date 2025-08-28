'use client';

import { format, parseISO, startOfMonth } from 'date-fns';
import { Edit, Eye, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import type { Expense, Person, Category } from '@/app/page';

interface ExpenseHistoryProps {
  expenses: Expense[];
  people: Person[];
  categories: Category[];
  onEditExpense: (expense: Expense) => void;
  onViewExpense: (expense: Expense) => void;
}

export function ExpenseHistory({ expenses, people, categories, onEditExpense, onViewExpense }: ExpenseHistoryProps) {
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');

  // Apply filters
  const filteredExpenses = expenses.filter(expense => {
    const categoryMatch = categoryFilter === 'all' || expense.category === categoryFilter;
    const personMatch = personFilter === 'all' || 
      expense.paidBy === personFilter || 
      expense.beneficiaries.includes(personFilter);
    
    return categoryMatch && personMatch;
  });

  // Group expenses by month
  const expensesByMonth = filteredExpenses.reduce((acc, expense) => {
    const monthKey = format(startOfMonth(parseISO(expense.date)), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  // Sort months in descending order
  const sortedMonths = Object.keys(expensesByMonth).sort((a, b) => b.localeCompare(a));

  const toggleMonth = (monthKey: string) => {
    const newOpenMonths = new Set(openMonths);
    if (newOpenMonths.has(monthKey)) {
      newOpenMonths.delete(monthKey);
    } else {
      newOpenMonths.add(monthKey);
    }
    setOpenMonths(newOpenMonths);
  };

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <CardTitle className="text-lg md:text-xl">支出履歴</CardTitle>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedMonths.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm md:text-base">
                {expenses.length === 0 
                  ? '支出履歴がありません' 
                  : 'フィルター条件に一致する支出がありません'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedMonths.map((monthKey) => {
                const monthExpenses = expensesByMonth[monthKey];
                const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                const isOpen = openMonths.has(monthKey);
                const monthDate = parseISO(monthKey + '-01');

                return (
                  <Collapsible key={monthKey} open={isOpen} onOpenChange={() => toggleMonth(monthKey)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 md:p-4 h-auto bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-900 text-sm md:text-base">
                              {format(monthDate, 'yyyy年M月')}
                            </h3>
                            <p className="text-xs md:text-sm text-gray-600">
                              {monthExpenses.length}件の支出
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-sm md:text-base">
                            ¥{monthTotal.toLocaleString()}
                          </p>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {monthExpenses
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((expense) => (
                          <div
                            key={expense.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-gray-200 ml-4 md:ml-6 gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <div 
                                  className="w-3 h-3 rounded-full"
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
                              </div>
                              <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">{expense.description}</h4>
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
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <div className="text-left sm:text-right">
                                <p className="font-bold text-gray-900 text-sm md:text-base">
                                  ¥{expense.amount.toLocaleString()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onViewExpense(expense)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditExpense(expense)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}