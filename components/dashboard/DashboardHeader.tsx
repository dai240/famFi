'use client';

import { useState } from 'react';
import { Bell, Settings, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface DashboardHeaderProps {
  userName?: string;
  userEmail?: string;
  totalBalance?: number;
  monthlyBudget?: number;
  notificationCount?: number;
}

export function DashboardHeader({
  userName = '田中太郎',
  userEmail = 'tanaka@example.com',
  totalBalance = 245000,
  monthlyBudget = 300000,
  notificationCount = 3,
}: DashboardHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const budgetUsedPercentage = Math.round((totalBalance / monthlyBudget) * 100);
  const isOverBudget = budgetUsedPercentage > 100;

  return (
    <div className="md:hidden bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                おかえりなさい、{userName.split(' ')[0]}さん！
              </h1>
              <p className="text-sm text-gray-600">今月の家計状況をご確認ください</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 通知 */}
            <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-8 w-8 p-0">
                  <Bell className="w-4 h-4" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>通知</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">予算アラート</p>
                    <p className="text-sm text-gray-600">今月の予算の85%を使用しています</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">定期支払い</p>
                    <p className="text-sm text-gray-600">Netflix の支払いが明日です</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">目標達成</p>
                    <p className="text-sm text-gray-600">旅行の目標まで90%達成しました！</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ユーザーメニュー */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 h-8">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src="/placeholder-avatar.jpg" alt={userName} />
                    <AvatarFallback className="text-xs">{userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>マイアカウント</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  プロフィール
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  設定
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 家計概要カード - モバイル用コンパクト版 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg border p-3 shadow-sm">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">現在の残高</p>
              <p className="text-lg font-bold text-gray-900">
                ¥{totalBalance.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-3 shadow-sm">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">月間予算</p>
              <p className="text-lg font-bold text-gray-900">
                ¥{monthlyBudget.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-3 shadow-sm">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">予算使用率</p>
              <p className={`text-lg font-bold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                {budgetUsedPercentage}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}