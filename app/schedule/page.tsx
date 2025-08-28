'use client';

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EventManagement } from "@/components/schedule/EventManagement";
import { UpcomingMilestones } from "@/components/schedule/UpcomingMilestones";
import { useDashboard } from "@/hooks/useDashboard";

export default function SchedulePage() {
  const {
    currentMonth,
    people,
    events,
    setCurrentMonth,
    setEvents,
  } = useDashboard();

  // scheduleページ用の状態
  const [currentView, setCurrentView] = useState<'events' | 'milestones'>('events');

  // 型安全なハンドラ
  const handleViewChange = (view: string) => {
    if (['events', 'milestones'].includes(view)) {
      setCurrentView(view as 'events' | 'milestones');
    }
  };

  return (
    <DashboardLayout
      currentMonth={currentMonth}
      currentView={currentView}
      onMonthChange={setCurrentMonth}
      onViewChange={handleViewChange} // ← 修正
    >
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">予定管理</h1>
        <p className="text-gray-600">イベントや大型支出の予定を管理します</p>
      </div>

      {/* ナビゲーション */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setCurrentView('events')}
          className={`px-4 py-2 rounded-lg font-medium ${
            currentView === 'events' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          イベント管理
        </button>
        <button 
          onClick={() => setCurrentView('milestones')}
          className={`px-4 py-2 rounded-lg font-medium ${
            currentView === 'milestones' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          大型支出予定
        </button>
      </div>

      {/* メイン表示 */}
      {currentView === 'events' && (
        <EventManagement
          events={events}
          people={people}
          currentMonth={currentMonth}
          onUpdateEvents={setEvents}
        />
      )}
      {currentView === 'milestones' && (
        <UpcomingMilestones />
      )}
    </DashboardLayout>
  );
}