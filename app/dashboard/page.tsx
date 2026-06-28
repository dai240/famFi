'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MonthlyOverview } from "@/components/dashboard/MonthlyOverview";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ExpenseCategories } from "@/components/household/ExpenseCategories";
import { SavingsGoals } from "@/components/household/SavingsGoals";
import { UpcomingMilestones } from "@/components/schedule/UpcomingMilestones";
import { useDashboard } from "@/hooks/useDashboard";

export default function DashboardPage() {
  const router = useRouter();
  const {
    currentMonth,
    people,
    expenses,
    income,
    categories,
    monthlyReflections,
    monthlyConfirmations,
    setCurrentMonth,
    handleAddExpense,
    handleAddIncome,
    handleSaveMonthlyReflection,
    handleMonthlyConfirmation,
  } = useDashboard();

  // ビュー変更時の処理
  const handleViewChange = (view: string) => {
    switch (view) {
      case 'household':
        router.push('/household');
        break;
      case 'schedule':
        router.push('/schedule');
        break;
      case 'housework':
        router.push('/housework');
        break;
      case 'recipe':
        router.push('/recipe');
        break;
      case 'management':
        router.push('/management');
        break;
      default:
        // ダッシュボードの場合は何もしない
        break;
    }
  };

  // コールバック
  const handleOpenReflection = () => { /* モーダル表示など */ };

  return (
    <DashboardLayout
      currentMonth={currentMonth}
      currentView="dashboard"
      onMonthChange={setCurrentMonth}
      onViewChange={handleViewChange}
      onAddExpense={() => handleAddExpense()}
    >
      {/* モバイル用ヘッダー */}
      <div className="md:hidden">
        <DashboardHeader
          userName={people[0]?.name ?? "田中太郎"}
          userEmail={people[0]?.name ? `${people[0].name}@example.com` : "tanaka@example.com"}
          totalBalance={100000}
          monthlyBudget={180000}
          notificationCount={3}
        />
      </div>

      <MonthlyOverview
        currentMonth={currentMonth}
        expenses={expenses}
        income={income}
        people={people}
        monthlyReflections={monthlyReflections}
        monthlyConfirmations={monthlyConfirmations}
        onOpenReflection={handleOpenReflection}
        onMonthlyConfirmation={handleMonthlyConfirmation}
      />
      <div className="grid grid-cols-1 lg:grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ExpenseCategories
            currentMonth={currentMonth}
            expenses={expenses}
            categories={categories}
          />
        </div>
        <div className="space-y-6">
          <QuickActions
            onAddExpense={() => handleAddExpense()}
            onAddIncome={() => handleAddIncome()}
          />
          <SavingsGoals />
          <UpcomingMilestones />
        </div>
      </div>
    </DashboardLayout>
  );
}