'use client';

import { DollarSign, Plus, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isSameMonth } from 'date-fns';
import type { Income, Person } from '@/app/page';

interface IncomeManagementProps {
  income: Income[];
  people: Person[];
  currentMonth: Date;
  onAddIncome: () => void;
}

export function IncomeManagement({ income, people, currentMonth, onAddIncome }: IncomeManagementProps) {
  const currentMonthIncome = income.filter(inc => 
    isSameMonth(new Date(inc.date), currentMonth)
  );

  const totalIncome = currentMonthIncome.reduce((sum, inc) => sum + inc.amount, 0);

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  // Group income by person
  const incomeByPerson = currentMonthIncome.reduce((acc, inc) => {
    const personName = getPersonName(inc.personId);
    if (!acc[personName]) {
      acc[personName] = { total: 0, items: [] };
    }
    acc[personName].total += inc.amount;
    acc[personName].items.push(inc);
    return acc;
  }, {} as Record<string, { total: number; items: Income[] }>);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Monthly Summary */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              {format(currentMonth, 'yyyy年M月')}の入金管理
            </CardTitle>
            <Button onClick={onAddIncome} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              入金を追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 md:p-6 mb-6">
            <div className="text-center">
              <p className="text-sm text-green-600 font-medium mb-2">今月の総入金額</p>
              <p className="text-2xl md:text-3xl font-bold text-green-900">
                ¥{totalIncome.toLocaleString()}
              </p>
              <p className="text-sm text-green-700 mt-2">
                {currentMonthIncome.length}件の入金
              </p>
            </div>
          </div>

          {/* Income by Person */}
          {Object.keys(incomeByPerson).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">人別入金額</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(incomeByPerson).map(([personName, data]) => (
                  <div key={personName} className="p-3 md:p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900 text-sm md:text-base">{personName}</span>
                      </div>
                      <span className="font-bold text-green-600 text-sm md:text-base">
                        ¥{data.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {data.items.map((inc) => (
                        <div key={inc.id} className="text-sm bg-white p-2 md:p-3 rounded border">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                            <span className="text-gray-900 font-medium">{inc.description}</span>
                            <span className="font-medium text-sm">¥{inc.amount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-gray-600">
                            <Calendar className="w-3 h-3" />
                            <span className="text-xs">{format(new Date(inc.date), 'M/d')}</span>
                          </div>
                          {inc.comment && (
                            <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-1 rounded">{inc.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Income List */}
          {currentMonthIncome.length > 0 && (
            <div className="space-y-4 mt-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">入金一覧</h3>
              <div className="space-y-3">
                {currentMonthIncome
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((inc) => (
                    <div key={inc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 bg-gray-50 rounded-lg gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm md:text-base mb-2">{inc.description}</h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <span className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(inc.date), 'M/d')}
                          </span>
                          <span className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getPersonName(inc.personId)}
                          </span>
                        </div>
                        {inc.comment && (
                          <p className="text-xs md:text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2 inline-block">
                            {inc.comment}
                          </p>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-bold text-green-600 text-sm md:text-base">
                          ¥{inc.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {currentMonthIncome.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4 text-sm md:text-base">今月の入金はまだありません</p>
              <Button onClick={onAddIncome} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                最初の入金を追加
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}