'use client';

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HouseworkManagement } from "@/components/common/HouseworkManagement";
import { useDashboard } from "@/hooks/useDashboard";

export default function HouseworkPage() {
  const {
    currentMonth,
    people,
    houseworkTasks,
    houseworkRecords,
    setCurrentMonth,
    setHouseworkTasks,
    setHouseworkRecords,
  } = useDashboard();

  return (
    <DashboardLayout
      currentMonth={currentMonth}
      currentView="housework"
      onMonthChange={setCurrentMonth}
      onViewChange={() => {}}
    >
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">家事管理</h1>
        <p className="text-gray-600">家事のタスクと記録を管理します</p>
      </div>

      {/* メイン表示 */}
      <HouseworkManagement
        tasks={houseworkTasks}
        records={houseworkRecords}
        people={people}
        currentMonth={currentMonth}
        onUpdateTasks={setHouseworkTasks}
        onUpdateRecords={setHouseworkRecords}
      />
    </DashboardLayout>
  );
}