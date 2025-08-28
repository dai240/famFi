'use client';

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PeopleManagement } from "@/components/people/PeopleManagement";
import { useDashboard } from "@/hooks/useDashboard";

export default function PeoplePage() {
  const {
    people,
    handleAddPerson,
    handleEditPerson,
  } = useDashboard();

  // 型安全なハンドラ
  const handleAddPersonWrapper = () => {
    // ここでモーダルを開くなどの処理
    console.log('Add person clicked');
  };

  return (
    <DashboardLayout
      currentMonth={new Date()}
      currentView="people"
      onMonthChange={() => {}}
      onViewChange={() => {}}
    >
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">家族・メンバー管理</h1>
        <p className="text-gray-600">家族やメンバーの情報を管理します</p>
      </div>

      {/* メイン表示 */}
      <PeopleManagement
        people={people}
        onAddPerson={handleAddPersonWrapper} // ← 修正
        onEditPerson={handleEditPerson}
      />
    </DashboardLayout>
  );
}