'use client';

import { ReactNode } from 'react';
import { DesktopHeader } from '@/components/common/DesktopHeader';
import { BottomNavigation } from '@/components/common/BottomNavigation';

interface DashboardLayoutProps {
  children: ReactNode;
  currentMonth: Date;
  currentView: string;
  onMonthChange: (date: Date) => void;
  onViewChange: (view: string) => void;
  onAddExpense?: () => void;
  showBottomNavigation?: boolean;
}

export function DashboardLayout({
  children,
  currentMonth,
  currentView,
  onMonthChange,
  onViewChange,
  onAddExpense,
  showBottomNavigation = true,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Desktop Header */}
      <DesktopHeader
        currentMonth={currentMonth}
        currentView={currentView}
        onMonthChange={onMonthChange}
        onViewChange={onViewChange}
        onAddExpense={onAddExpense}
      />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {showBottomNavigation && (
        <div className="md:hidden">
          <BottomNavigation 
            currentView={currentView}
            onViewChange={onViewChange}
          />
        </div>
      )}
    </div>
  );
}