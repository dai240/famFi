'use client';

import { isSameMonth, subMonths } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Wallet, MessageSquare, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Expense, Income, Person, MonthlyReflection, MonthlyConfirmation } from '@/app/page';

interface MonthlyOverviewProps {
  currentMonth: Date;
  expenses: Expense[];
  income: Income[];
  people: Person[];
  monthlyReflections: MonthlyReflection[];
  monthlyConfirmations: MonthlyConfirmation[];
  onOpenReflection: () => void;
  onMonthlyConfirmation: (month: string, isConfirmed: boolean) => void;
}

export function MonthlyOverview({ 
  currentMonth, 
  expenses, 
  income, 
  people, 
  monthlyReflections, 
  monthlyConfirmations,
  onOpenReflection,
  onMonthlyConfirmation
}: MonthlyOverviewProps) {
  // Calculate actual expenses for current month
  const currentMonthExpenses = expenses.filter(expense => 
    isSameMonth(new Date(expense.date), currentMonth)
  );
  
  const currentMonthIncome = income.filter(inc => 
    isSameMonth(new Date(inc.date), currentMonth)
  );

  // Calculate previous month data
  const previousMonth = subMonths(currentMonth, 1);
  const previousMonthExpenses = expenses.filter(expense => 
    isSameMonth(new Date(expense.date), previousMonth)
  );
  
  const previousMonthIncome = income.filter(inc => 
    isSameMonth(new Date(inc.date), previousMonth)
  );
  
  const totalExpenses = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalIncome = currentMonthIncome.reduce((sum, inc) => sum + inc.amount, 0);
  const previousTotalExpenses = previousMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const previousTotalIncome = previousMonthIncome.reduce((sum, inc) => sum + inc.amount, 0);
  
  // Mock data for budget and pool balance - replace with real data later
  const monthlyData = {
    income: totalIncome,
    expenses: totalExpenses,
    savings: totalIncome - totalExpenses,
    poolBalance: 145000,
    budget: 180000
  };

  const previousMonthData = {
    income: previousTotalIncome,
    expenses: previousTotalExpenses,
    savings: previousTotalIncome - previousTotalExpenses
  };

  const budgetUsage = monthlyData.budget > 0 ? (monthlyData.expenses / monthlyData.budget) * 100 : 0;
  const isPositive = monthlyData.savings > 0;

  // Get reflection for current month
  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const currentReflection = monthlyReflections.find(r => r.month === monthKey);

  // Get confirmation status for current month
  const currentConfirmation = monthlyConfirmations.find(c => c.month === monthKey);
  const isCurrentMonthConfirmed = currentConfirmation?.isConfirmed || false;

  // Check for unconfirmed previous months
  const unconfirmedMonths = monthlyConfirmations.filter(c => !c.isConfirmed && c.month < monthKey);

  const formatComparison = (current: number, previous: number) => {
    const diff = current - previous;
    const isIncrease = diff > 0;
    const percentage = previous > 0 ? Math.abs((diff / previous) * 100) : 0;
    
    return {
      diff,
      isIncrease,
      percentage,
      text: `${isIncrease ? '+' : '-'}¥${Math.abs(diff).toLocaleString()}`,
      color: isIncrease ? 'text-red-600' : 'text-green-600'
    };
  };

  const incomeComparison = formatComparison(monthlyData.income, previousMonthData.income);
  const expenseComparison = formatComparison(monthlyData.expenses, previousMonthData.expenses);
  const savingsComparison = formatComparison(monthlyData.savings, previousMonthData.savings);

  const handleConfirmationToggle = () => {
    onMonthlyConfirmation(monthKey, !isCurrentMonthConfirmed);
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              今月の家計状況
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenReflection}
                className="flex items-center gap-2 w-full sm:w-auto text-xs md:text-sm"
              >
                <MessageSquare className="w-3 h-3 md:w-4 md:h-4" />
                {currentReflection ? '振り返りを編集' : '振り返りを追加'}
              </Button>
              <Button
                variant={isCurrentMonthConfirmed ? "default" : "outline"}
                size="sm"
                onClick={handleConfirmationToggle}
                className={`flex items-center gap-2 w-full sm:w-auto text-xs md:text-sm ${
                  isCurrentMonthConfirmed 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'border-green-600 text-green-600 hover:bg-green-50'
                }`}
              >
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                {isCurrentMonthConfirmed ? '入力完了済み' : '入力完了'}
              </Button>
            </div>
          </div>
          
          {/* Unconfirmed months warning */}
          {unconfirmedMonths.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  未完了の月があります: {unconfirmedMonths.map(m => m.month).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-blue-600 font-medium">入金額</p>
                <p className="text-lg md:text-2xl font-bold text-blue-900">
                  ¥{monthlyData.income.toLocaleString()}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-xs text-blue-700">
                    先月: ¥{previousMonthData.income.toLocaleString()}
                  </span>
                  <span className={`text-xs font-medium ${incomeComparison.color}`}>
                    {incomeComparison.text}
                  </span>
                </div>
              </div>
              <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-red-600 font-medium">支出</p>
                <p className="text-lg md:text-2xl font-bold text-red-900">
                  ¥{monthlyData.expenses.toLocaleString()}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-xs text-red-700">
                    先月: ¥{previousMonthData.expenses.toLocaleString()}
                  </span>
                  <span className={`text-xs font-medium ${expenseComparison.color}`}>
                    {expenseComparison.text}
                  </span>
                </div>
              </div>
              <TrendingDown className="w-6 h-6 md:w-8 md:h-8 text-red-500 flex-shrink-0" />
            </div>
          </div>

          <div className={`bg-gradient-to-br ${isPositive ? 'from-green-50 to-green-100' : 'from-yellow-50 to-yellow-100'} rounded-lg p-3 md:p-4`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className={`text-xs md:text-sm font-medium ${isPositive ? 'text-green-600' : 'text-yellow-600'}`}>
                  {isPositive ? '余剰' : '不足'}
                </p>
                <p className={`text-lg md:text-2xl font-bold ${isPositive ? 'text-green-900' : 'text-yellow-900'}`}>
                  ¥{Math.abs(monthlyData.savings).toLocaleString()}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <span className={`text-xs ${isPositive ? 'text-green-700' : 'text-yellow-700'}`}>
                    先月: ¥{Math.abs(previousMonthData.savings).toLocaleString()}
                  </span>
                  <span className={`text-xs font-medium ${savingsComparison.color}`}>
                    {savingsComparison.text}
                  </span>
                </div>
              </div>
              <Wallet className={`w-6 h-6 md:w-8 md:h-8 ${isPositive ? 'text-green-500' : 'text-yellow-500'} flex-shrink-0`} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-purple-600 font-medium">プール残高</p>
                <p className="text-lg md:text-2xl font-bold text-purple-900">
                  ¥{monthlyData.poolBalance.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-purple-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">予算使用率</span>
            <span className={`text-sm font-bold ${budgetUsage > 90 ? 'text-red-600' : budgetUsage > 75 ? 'text-yellow-600' : 'text-green-600'}`}>
              {budgetUsage.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={budgetUsage} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 mt-2">
            予算: ¥{monthlyData.budget.toLocaleString()} / 
            {budgetUsage > 100 ? ` ¥${(monthlyData.expenses - monthlyData.budget).toLocaleString()}オーバー` : 
             ` 残り¥${(monthlyData.budget - monthlyData.expenses).toLocaleString()}`}
          </p>
        </div>

        {currentReflection && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">今月の振り返り</span>
            </div>
            <p className="text-sm text-blue-900 mb-2">{currentReflection.reflection}</p>
            {currentReflection.goals && (
              <p className="text-xs text-blue-700">
                <span className="font-medium">来月の目標:</span> {currentReflection.goals}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}