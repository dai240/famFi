'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExpenseList } from "@/components/household/ExpenseList";
import { ExpenseManagement } from "@/components/household/ExpenseManagement";
import { IncomeManagement } from "@/components/household/IncomeManagement";
import { ExpenseHistory } from "@/components/household/ExpenseHistory";
import { CategoryManagement } from "@/components/household/CategoryManagement";
import { AddExpenseModal } from "@/components/household/AddExpenseModal";
import { AddRecurringExpenseModal } from "@/components/household/AddRecurringExpenseModal";
import { ConfirmExpenseModal } from "@/components/household/ConfirmExpenseModal";
import { useDashboard } from "@/hooks/useDashboard";
import type { MonthlyExpenseStatus, RecurringExpense } from "@/types";

export default function HouseholdPage() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');

  const {
    currentMonth,
    people,
    categories,
    expenses,
    income,
    recurringExpenses,
    monthlyExpenseStatuses,
    setCurrentMonth,
    handleAddExpense,
    handleEditExpense,
    handleAddIncome,
    handleAddRecurringExpense,
    handleEditRecurringExpense,
    handleConfirmExpense,
    handleUpdateCategories,
    handleOpenEditExpense,
    handleOpenExpenseDetail,
  } = useDashboard();

  // householdページ用の状態
  const [currentView, setCurrentView] = useState<'expenses' | 'expense-management' | 'income' | 'history' | 'categories'>('expenses');

  // クエリパラメータに基づいてビューを決定
  useEffect(() => {
    if (viewParam && ['expenses', 'expense-management', 'income', 'history', 'categories'].includes(viewParam)) {
      setCurrentView(viewParam as 'expenses' | 'expense-management' | 'income' | 'history' | 'categories');
    }
  }, [viewParam]);

  // モーダル状態
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddRecurringExpenseOpen, setIsAddRecurringExpenseOpen] = useState(false);
  const [isConfirmExpenseOpen, setIsConfirmExpenseOpen] = useState(false);
  const [selectedMonthlyStatus, setSelectedMonthlyStatus] = useState<MonthlyExpenseStatus | null>(null);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState<RecurringExpense | null>(null);

  // 型安全なハンドラ
  const handleViewChange = (view: string) => {
    if (['expenses', 'expense-management', 'income', 'history', 'categories'].includes(view)) {
      setCurrentView(view as 'expenses' | 'expense-management' | 'income' | 'history' | 'categories');
    }
  };

  // 支出追加ハンドラ
  const handleAddExpenseClick = () => {
    setIsAddExpenseOpen(true);
  };

  // 支出追加完了ハンドラ
  const handleAddExpenseComplete = (expense: any) => {
    handleAddExpense(expense);
    setIsAddExpenseOpen(false);
  };

  // 定期支出追加ハンドラ
  const handleAddRecurringExpenseClick = () => {
    setIsAddRecurringExpenseOpen(true);
  };

  // 定期支出追加完了ハンドラ
  const handleAddRecurringExpenseComplete = (expense: any) => {
    handleAddRecurringExpense(expense);
    setIsAddRecurringExpenseOpen(false);
  };

  // 確定ボタンハンドラ（型を修正）
  const handleConfirmExpenseClick = (monthlyStatus: MonthlyExpenseStatus) => {
    console.log('確定ボタンがクリックされました:', monthlyStatus); // ← デバッグログ追加
    const recurringExpense = recurringExpenses.find(re => re.id === monthlyStatus.recurringExpenseId);
    setSelectedMonthlyStatus(monthlyStatus);
    setSelectedRecurringExpense(recurringExpense || null);
    setIsConfirmExpenseOpen(true);
  };

  // handleToggleRecurringExpenseStatus を修正
const handleToggleRecurringExpenseStatus = (monthlyStatus: MonthlyExpenseStatus) => {
  console.log('ExpenseList の確定ボタンがクリックされました:', monthlyStatus);
  const recurringExpense = recurringExpenses.find(re => re.id === monthlyStatus.recurringExpenseId);
  setSelectedMonthlyStatus(monthlyStatus);
  setSelectedRecurringExpense(recurringExpense || null);
  setIsConfirmExpenseOpen(true);
};

  // 確定完了ハンドラ
  const handleConfirmExpenseComplete = (monthlyStatus: MonthlyExpenseStatus, amount?: number) => {
    handleConfirmExpense(monthlyStatus, amount);
    setIsConfirmExpenseOpen(false);
    setSelectedMonthlyStatus(null);
    setSelectedRecurringExpense(null);
  };

  return (
    <DashboardLayout
      currentMonth={currentMonth}
      currentView={currentView}
      onMonthChange={setCurrentMonth}
      onViewChange={handleViewChange}
      onAddExpense={handleAddExpenseClick}
    >
      {/* メイン表示 */}
      {currentView === 'expenses' && (
        <ExpenseList
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          monthlyExpenseStatuses={monthlyExpenseStatuses}
          currentMonth={currentMonth}
          people={people}
          categories={categories}
          onEditExpense={handleOpenEditExpense}
          onViewExpense={handleOpenExpenseDetail}
          onAddExpense={handleAddExpenseClick}
          onToggleRecurringExpenseStatus={handleToggleRecurringExpenseStatus}
        />
      )}
      {currentView === 'expense-management' && (
        <ExpenseManagement
          recurringExpenses={recurringExpenses}
          monthlyExpenseStatuses={monthlyExpenseStatuses}
          currentMonth={currentMonth}
          people={people}
          categories={categories}
          onAddRecurringExpense={handleAddRecurringExpenseClick}
          onEditRecurringExpense={handleEditRecurringExpense}
          onConfirmExpense={handleConfirmExpenseClick} // ← 修正
        />
      )}
      {currentView === 'income' && (
        <IncomeManagement
          income={income}
          people={people}
          currentMonth={currentMonth}
          onAddIncome={() => handleAddIncome()}
        />
      )}
      {currentView === 'history' && (
        <ExpenseHistory
          expenses={expenses}
          people={people}
          categories={categories}
          onEditExpense={handleOpenEditExpense}
          onViewExpense={handleOpenExpenseDetail}
        />
      )}
      {currentView === 'categories' && (
        <CategoryManagement
          categories={categories}
          onUpdateCategories={handleUpdateCategories}
        />
      )}

      {/* モーダル */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSave={handleAddExpenseComplete}
        people={people}
        categories={categories}
      />

      <AddRecurringExpenseModal
        isOpen={isAddRecurringExpenseOpen}
        onClose={() => setIsAddRecurringExpenseOpen(false)}
        onSave={handleAddRecurringExpenseComplete}
        people={people}
        categories={categories}
      />

      <ConfirmExpenseModal
        isOpen={isConfirmExpenseOpen}
        monthlyStatus={selectedMonthlyStatus}
        recurringExpense={selectedRecurringExpense}
        onClose={() => {
          setIsConfirmExpenseOpen(false);
          setSelectedMonthlyStatus(null);
          setSelectedRecurringExpense(null);
        }}
        onConfirm={handleConfirmExpenseComplete}
      />
    </DashboardLayout>
  );
}