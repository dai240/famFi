'use client';

import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navigation } from '@/components/common/Navigation';

interface DesktopHeaderProps {
  currentMonth: Date;
  currentView: string;
  onMonthChange: (date: Date) => void;
  onViewChange: (view: string) => void;
  onAddExpense?: () => void;
}

export function DesktopHeader({
  currentMonth,
  currentView,
  onMonthChange,
  onViewChange,
  onAddExpense
}: DesktopHeaderProps) {
  const previousMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  return (
    <div className="hidden md:block">
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-gray-900">家計管理</h1>
              
              <Navigation 
                currentView={currentView}
                onViewChange={onViewChange}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[100px] text-center">
                  {format(currentMonth, 'yyyy年M月')}
                </span>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {onAddExpense && (
                <Button onClick={onAddExpense}>
                  <Plus className="w-4 h-4 mr-2" />
                  支出追加
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}