'use client';

import { isSameMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import type { Expense, Category } from '@/types';

interface ExpenseCategoriesProps {
  currentMonth: Date;
  expenses: Expense[];
  categories: Category[];
}

export function ExpenseCategories({ currentMonth, expenses, categories }: ExpenseCategoriesProps) {
  // Filter expenses for current month
  const currentMonthExpenses = expenses.filter(expense => 
    isSameMonth(new Date(expense.date), currentMonth)
  );

  // Group expenses by category
  const categoryData = currentMonthExpenses.reduce((acc, expense) => {
    const existing = acc.find(item => item.name === expense.category);
    const category = categories.find(cat => cat.name === expense.category);
    const color = category?.color || '#8B5CF6';
    
    if (existing) {
      existing.value += expense.amount;
    } else {
      acc.push({
        name: expense.category,
        value: expense.amount,
        color: color
      });
    }
    return acc;
  }, [] as Array<{ name: string; value: number; color: string }>);

  // Mock monthly trend data with category breakdown
  const monthlyTrend = [
    { 
      month: '4月', 
      amount: 150000,
      住居費: 80000,
      食費: 35000,
      育児教育: 20000,
      その他: 15000
    },
    { 
      month: '5月', 
      amount: 160000,
      住居費: 80000,
      食費: 40000,
      育児教育: 25000,
      その他: 15000
    },
    { 
      month: '6月', 
      amount: 155000,
      住居費: 80000,
      食費: 38000,
      育児教育: 22000,
      その他: 15000
    },
    { 
      month: '7月', 
      amount: currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      住居費: currentMonthExpenses.filter(e => e.category === '住居費').reduce((sum, e) => sum + e.amount, 0),
      食費: currentMonthExpenses.filter(e => e.category === '食費').reduce((sum, e) => sum + e.amount, 0),
      育児教育: currentMonthExpenses.filter(e => e.category === '育児・教育').reduce((sum, e) => sum + e.amount, 0),
      その他: currentMonthExpenses.filter(e => !['住居費', '食費', '育児・教育'].includes(e.category)).reduce((sum, e) => sum + e.amount, 0)
    },
  ];

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BarChart3 className="w-5 h-5 text-green-600" />
          支出カテゴリ分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pie" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pie" className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              カテゴリ別
            </TabsTrigger>
            <TabsTrigger value="trend" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              推移
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pie" className="space-y-4">
            {categoryData.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%\" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {categoryData.map((category, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div 
                        className="w-4 h-4 rounded-full mt-0.5"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {category.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          ¥{category.value.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">今月の支出データがありません</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="trend" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                  <Bar dataKey="住居費" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="食費" stackId="a" fill="#10B981" />
                  <Bar dataKey="育児教育" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="その他" stackId="a" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">トレンド分析:</span> 
                今月の支出は¥{currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0).toLocaleString()}です。
                カテゴリ別の色分けで支出の内訳を確認できます。
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}