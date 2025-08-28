'use client';

import { Plus, Upload, Download, Settings, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickActionsProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
}

export function QuickActions({ onAddExpense, onAddIncome }: QuickActionsProps) {
  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">クイックアクション</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          className="w-full justify-start gap-2" 
          variant="default"
          onClick={onAddExpense}
        >
          <Plus className="w-4 h-4" />
          支出を追加
        </Button>
        
        <Button 
          className="w-full justify-start gap-2" 
          variant="outline"
          onClick={onAddIncome}
        >
          <DollarSign className="w-4 h-4" />
          入金を追加
        </Button>
        
        <Button className="w-full justify-start gap-2" variant="outline">
          <Upload className="w-4 h-4" />
          CSVをアップロード
        </Button>
        
        <Button className="w-full justify-start gap-2" variant="outline">
          <Download className="w-4 h-4" />
          月次レポート
        </Button>
        
        <Button className="w-full justify-start gap-2" variant="ghost">
          <Settings className="w-4 h-4" />
          設定
        </Button>
      </CardContent>
    </Card>
  );
}