'use client';

import { Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const milestones = [
  {
    id: 1,
    title: '火災保険の更新',
    amount: 200000,
    dueDate: '2024年9月',
    status: 'upcoming',
    description: '年間保険料の支払い'
  },
  {
    id: 2,
    title: '車検費用',
    amount: 120000,
    dueDate: '2024年11月',
    status: 'preparing',
    description: '定期車検とメンテナンス'
  },
  {
    id: 3,
    title: '固定資産税',
    amount: 180000,
    dueDate: '2024年12月',
    status: 'scheduled',
    description: '年末の税金支払い'
  }
];

const statusConfig = {
  upcoming: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: '要準備' },
  preparing: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: '準備中' },
  scheduled: { icon: Calendar, color: 'bg-blue-100 text-blue-800', label: '予定済み' },
  completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: '完了' }
};

export function UpcomingMilestones() {
  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calendar className="w-5 h-5 text-orange-600" />
          大型支出の予定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.map((milestone) => {
          const config = statusConfig[milestone.status as keyof typeof statusConfig];
          const Icon = config.icon;
          
          return (
            <div key={milestone.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{milestone.title}</h3>
                    <Badge className={config.color}>
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{milestone.dueDate}</span>
                    <span className="font-bold text-gray-900">
                      ¥{milestone.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">今後3ヶ月の合計</span>
          </div>
          <p className="text-lg font-bold text-orange-900">
            ¥{milestones.reduce((sum, m) => sum + m.amount, 0).toLocaleString()}
          </p>
          <p className="text-xs text-orange-700 mt-1">
            プール金から十分に支払い可能です
          </p>
        </div>
      </CardContent>
    </Card>
  );
}