'use client';

import { Target, Car, Home, Plane } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

const savingsGoals = [
  {
    id: 1,
    title: '車の買い替え',
    target: 1500000,
    current: 800000,
    deadline: '2024年12月',
    icon: Car,
    color: 'bg-blue-500'
  },
  {
    id: 2,
    title: '住宅修繕費',
    target: 500000,
    current: 320000,
    deadline: '2025年3月',
    icon: Home,
    color: 'bg-green-500'
  },
  {
    id: 3,
    title: '家族旅行',
    target: 300000,
    current: 150000,
    deadline: '2024年8月',
    icon: Plane,
    color: 'bg-purple-500'
  }
];

export function SavingsGoals() {
  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Target className="w-5 h-5 text-purple-600" />
          貯蓄目標
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {savingsGoals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const Icon = goal.icon;
          
          return (
            <div key={goal.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${goal.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                  <p className="text-xs text-gray-600">期限: {goal.deadline}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    ¥{goal.current.toLocaleString()} / ¥{goal.target.toLocaleString()}
                  </span>
                  <span className="font-medium text-gray-900">
                    {progress.toFixed(1)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                
                {progress >= 100 ? (
                  <div className="text-xs text-green-600 font-medium">
                    🎉 目標達成！
                  </div>
                ) : progress >= 75 ? (
                  <div className="text-xs text-blue-600 font-medium">
                    もう少しで達成！
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">
                    残り ¥{(goal.target - goal.current).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        <Button variant="outline" className="w-full mt-4">
          新しい目標を追加
        </Button>
      </CardContent>
    </Card>
  );
}