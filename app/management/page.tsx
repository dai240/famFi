'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useDashboard } from '@/hooks/useDashboard';
import { CategoryManagement } from '@/components/household/CategoryManagement';
import { PeopleManagement } from '@/components/people/PeopleManagement';
import { RecurringExpenseManagement } from '@/components/management/RecurringExpenseManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, CreditCard } from 'lucide-react';

export default function ManagementPage() {
  const { 
    currentMonth, 
    categories, 
    people, 
    recurringExpenses,
    setCurrentMonth, 
    setCategories, 
    setPeople,
    setRecurringExpenses
  } = useDashboard();

  const [currentView, setCurrentView] = useState<'categories' | 'people' | 'recurring-expenses'>('categories');

  const handleViewChange = (view: string) => {
    if (view === 'categories' || view === 'people' || view === 'recurring-expenses') {
      setCurrentView(view);
    }
  };

  return (
    <DashboardLayout 
      currentMonth={currentMonth} 
      currentView="management" 
      onMonthChange={setCurrentMonth} 
      onViewChange={handleViewChange}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="text-gray-600">カテゴリ、人、定期支出の管理を行います</p>
      </div>

      <Tabs value={currentView} onValueChange={handleViewChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            カテゴリ管理
          </TabsTrigger>
          <TabsTrigger value="people" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            人の管理
          </TabsTrigger>
          <TabsTrigger value="recurring-expenses" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            定期支出管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <CategoryManagement 
            categories={categories} 
            onUpdateCategories={setCategories} 
          />
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
          <PeopleManagement 
            people={people} 
            onAddPerson={() => {}}
            onEditPerson={(person) => {
              // 編集機能は後で実装
              console.log('Edit person:', person);
            }}
          />
        </TabsContent>

        <TabsContent value="recurring-expenses" className="space-y-4">
          <RecurringExpenseManagement 
            recurringExpenses={recurringExpenses}
            categories={categories}
            people={people}
            onUpdateRecurringExpenses={setRecurringExpenses}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
