'use client';

import { useState } from 'react';
import { format, isSameMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ClipboardList, Plus, Edit, Star, Calendar, User, CheckCircle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { HouseworkTask, HouseworkRecord, Person } from '@/app/page';

interface HouseworkManagementProps {
  tasks: HouseworkTask[];
  records: HouseworkRecord[];
  people: Person[];
  currentMonth: Date;
  onUpdateTasks: (tasks: HouseworkTask[]) => void;
  onUpdateRecords: (records: HouseworkRecord[]) => void;
}

const frequencyLabels = {
  daily: '毎日',
  weekly: '週1回',
  monthly: '月1回',
  custom: 'カスタム'
};

const categoryColors: Record<string, string> = {
  '掃除': 'bg-blue-100 text-blue-800',
  '洗濯': 'bg-green-100 text-green-800',
  '料理': 'bg-orange-100 text-orange-800',
  '買い物': 'bg-purple-100 text-purple-800',
  'その他': 'bg-gray-100 text-gray-800',
};

const categories = ['掃除', '洗濯', '料理', '買い物', 'その他'];

export function HouseworkManagement({
  tasks,
  records,
  people,
  currentMonth,
  onUpdateTasks,
  onUpdateRecords
}: HouseworkManagementProps) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HouseworkTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<HouseworkTask | null>(null);

  const [taskFormData, setTaskFormData] = useState({
    name: '',
    category: '',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'custom',
    assignedTo: '',
    description: '',
    isActive: true
  });

  const [recordFormData, setRecordFormData] = useState({
    taskId: '',
    date: new Date().toISOString().split('T')[0],
    completedBy: '',
    notes: '',
    rating: 5
  });

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const currentMonthRecords = records.filter(record => 
    isSameMonth(new Date(record.date), currentMonth)
  );

  const getTaskCompletionRate = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;

    const taskRecords = currentMonthRecords.filter(r => r.taskId === taskId);
    
    // Calculate expected completions based on frequency
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    let expectedCompletions = 0;
    
    switch (task.frequency) {
      case 'daily':
        expectedCompletions = daysInMonth;
        break;
      case 'weekly':
        expectedCompletions = Math.ceil(daysInMonth / 7);
        break;
      case 'monthly':
        expectedCompletions = 1;
        break;
      default:
        expectedCompletions = 1;
    }

    return Math.min((taskRecords.length / expectedCompletions) * 100, 100);
  };

  const getAverageRating = (taskId: string) => {
    const taskRecords = currentMonthRecords.filter(r => r.taskId === taskId && r.rating);
    if (taskRecords.length === 0) return 0;
    
    const totalRating = taskRecords.reduce((sum, record) => sum + (record.rating || 0), 0);
    return totalRating / taskRecords.length;
  };

  const activeTasks = tasks.filter(t => t.isActive);
  const tasksByCategory = activeTasks.reduce((acc, task) => {
    if (!acc[task.category]) {
      acc[task.category] = [];
    }
    acc[task.category].push(task);
    return acc;
  }, {} as Record<string, HouseworkTask[]>);

  const handleAddTask = () => {
    if (!taskFormData.name || !taskFormData.category || !taskFormData.assignedTo) return;

    const newTask: HouseworkTask = {
      id: Date.now().toString(),
      name: taskFormData.name,
      category: taskFormData.category,
      frequency: taskFormData.frequency,
      assignedTo: taskFormData.assignedTo,
      description: taskFormData.description || undefined,
      isActive: taskFormData.isActive
    };

    onUpdateTasks([...tasks, newTask]);
    setTaskFormData({
      name: '',
      category: '',
      frequency: 'weekly',
      assignedTo: '',
      description: '',
      isActive: true
    });
    setIsAddTaskOpen(false);
  };

  const handleEditTask = () => {
    if (!editingTask || !taskFormData.name || !taskFormData.category || !taskFormData.assignedTo) return;

    const updatedTask: HouseworkTask = {
      ...editingTask,
      name: taskFormData.name,
      category: taskFormData.category,
      frequency: taskFormData.frequency,
      assignedTo: taskFormData.assignedTo,
      description: taskFormData.description || undefined,
      isActive: taskFormData.isActive
    };

    onUpdateTasks(tasks.map(t => t.id === editingTask.id ? updatedTask : t));
    setIsEditTaskOpen(false);
    setEditingTask(null);
  };

  const handleAddRecord = () => {
    if (!recordFormData.taskId || !recordFormData.completedBy) return;

    const newRecord: HouseworkRecord = {
      id: Date.now().toString(),
      taskId: recordFormData.taskId,
      date: recordFormData.date,
      completedBy: recordFormData.completedBy,
      notes: recordFormData.notes || undefined,
      rating: recordFormData.rating
    };

    onUpdateRecords([...records, newRecord]);
    setRecordFormData({
      taskId: '',
      date: new Date().toISOString().split('T')[0],
      completedBy: '',
      notes: '',
      rating: 5
    });
    setIsAddRecordOpen(false);
  };

  const openEditTask = (task: HouseworkTask) => {
    setEditingTask(task);
    setTaskFormData({
      name: task.name,
      category: task.category,
      frequency: task.frequency,
      assignedTo: task.assignedTo,
      description: task.description || '',
      isActive: task.isActive
    });
    setIsEditTaskOpen(true);
  };

  const openAddRecord = (task: HouseworkTask) => {
    setSelectedTask(task);
    setRecordFormData({
      ...recordFormData,
      taskId: task.id
    });
    setIsAddRecordOpen(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="w-5 h-5 text-green-600" />
              家事管理
            </CardTitle>
            <Button onClick={() => setIsAddTaskOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              家事を追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">今月の概要</TabsTrigger>
              <TabsTrigger value="tasks">家事一覧</TabsTrigger>
              <TabsTrigger value="records">実行記録</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    {format(currentMonth, 'yyyy年M月')}の実行状況
                  </h3>
                  <div className="space-y-3">
                    {activeTasks.slice(0, 5).map((task) => {
                      const completionRate = getTaskCompletionRate(task.id);
                      return (
                        <div key={task.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-green-800">{task.name}</span>
                            <span className="text-green-700">{completionRate.toFixed(0)}%</span>
                          </div>
                          <Progress value={completionRate} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">担当者別実行回数</h3>
                  <div className="space-y-2">
                    {people.filter(p => p.group === '家族').map((person) => {
                      const personRecords = currentMonthRecords.filter(r => r.completedBy === person.id);
                      return (
                        <div key={person.id} className="flex justify-between items-center">
                          <span className="text-blue-800 font-medium">{person.name}</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            {personRecords.length}回
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">今週の予定</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTasks.filter(t => t.frequency === 'weekly' || t.frequency === 'daily').slice(0, 4).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                      <CheckCircle className="w-4 h-4 text-yellow-600" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{task.name}</span>
                        <p className="text-xs text-gray-600">担当: {getPersonName(task.assignedTo)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Badge className={categoryColors[task.category] || 'bg-gray-100 text-gray-800'}>
                          {frequencyLabels[task.frequency]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddRecord(task)}
                          className="h-6 px-2 text-xs"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              {Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>
                      {category}
                    </Badge>
                    <span className="text-sm text-gray-500">({categoryTasks.length}件)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryTasks.map((task) => {
                      const completionRate = getTaskCompletionRate(task.id);
                      const averageRating = getAverageRating(task.id);
                      return (
                        <div key={task.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{task.name}</h4>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openEditTask(task)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAddRecord(task)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>頻度:</span>
                              <Badge variant="outline">
                                {frequencyLabels[task.frequency]}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>担当:</span>
                              <span>{getPersonName(task.assignedTo)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>今月の実行率:</span>
                              <span className="font-medium">{completionRate.toFixed(0)}%</span>
                            </div>
                            {averageRating > 0 && (
                              <div className="flex justify-between items-center">
                                <span>平均評価:</span>
                                <div className="flex items-center gap-1">
                                  {renderStars(Math.round(averageRating))}
                                  <span className="ml-1">({averageRating.toFixed(1)})</span>
                                </div>
                              </div>
                            )}
                            {task.description && (
                              <p className="text-blue-600 bg-blue-50 p-2 rounded text-xs">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="records" className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {format(currentMonth, 'yyyy年M月')}の実行記録
                  </h3>
                  <Button onClick={() => setIsAddRecordOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    記録を追加
                  </Button>
                </div>
                {currentMonthRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">今月の実行記録はありません</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentMonthRecords
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => {
                        const task = tasks.find(t => t.id === record.taskId);
                        return (
                          <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900">
                                  {task?.name || '不明な家事'}
                                </h4>
                                {task && (
                                  <Badge className={categoryColors[task.category] || 'bg-gray-100 text-gray-800'}>
                                    {task.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(record.date), 'M/d')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {getPersonName(record.completedBy)}
                                </span>
                                {record.rating && (
                                  <div className="flex items-center gap-1">
                                    {renderStars(record.rating)}
                                  </div>
                                )}
                              </div>
                              {record.notes && (
                                <p className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                                  {record.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Task Modal */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>家事を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskName">家事名</Label>
              <Input
                id="taskName"
                value={taskFormData.name}
                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
                placeholder="例: 掃除機かけ"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="taskCategory">カテゴリ</Label>
              <Select value={taskFormData.category} onValueChange={(value) => setTaskFormData({ ...taskFormData, category: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="taskFrequency">頻度</Label>
              <Select value={taskFormData.frequency} onValueChange={(value) => setTaskFormData({ ...taskFormData, frequency: value as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">毎日</SelectItem>
                  <SelectItem value="weekly">週1回</SelectItem>
                  <SelectItem value="monthly">月1回</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="taskAssignedTo">担当者</Label>
              <Select value={taskFormData.assignedTo} onValueChange={(value) => setTaskFormData({ ...taskFormData, assignedTo: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.group === '家族').map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="taskDescription">説明（任意）</Label>
              <Textarea
                id="taskDescription"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="詳細な説明"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleAddTask} className="flex-1">
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>家事を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="taskActive">有効/無効</Label>
              <Switch
                id="taskActive"
                checked={taskFormData.isActive}
                onCheckedChange={(checked) => setTaskFormData({ ...taskFormData, isActive: checked })}
              />
            </div>

            <div>
              <Label htmlFor="editTaskName">家事名</Label>
              <Input
                id="editTaskName"
                value={taskFormData.name}
                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
                placeholder="例: 掃除機かけ"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="editTaskCategory">カテゴリ</Label>
              <Select value={taskFormData.category} onValueChange={(value) => setTaskFormData({ ...taskFormData, category: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editTaskFrequency">頻度</Label>
              <Select value={taskFormData.frequency} onValueChange={(value) => setTaskFormData({ ...taskFormData, frequency: value as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">毎日</SelectItem>
                  <SelectItem value="weekly">週1回</SelectItem>
                  <SelectItem value="monthly">月1回</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editTaskAssignedTo">担当者</Label>
              <Select value={taskFormData.assignedTo} onValueChange={(value) => setTaskFormData({ ...taskFormData, assignedTo: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.group === '家族').map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editTaskDescription">説明（任意）</Label>
              <Textarea
                id="editTaskDescription"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="詳細な説明"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditTaskOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleEditTask} className="flex-1">
                更新
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Record Modal */}
      <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>実行記録を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recordTask">家事</Label>
              <Select value={recordFormData.taskId} onValueChange={(value) => setRecordFormData({ ...recordFormData, taskId: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="家事を選択" />
                </SelectTrigger>
                <SelectContent>
                  {activeTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name} ({task.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recordDate">実行日</Label>
              <Input
                id="recordDate"
                type="date"
                value={recordFormData.date}
                onChange={(e) => setRecordFormData({ ...recordFormData, date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="recordCompletedBy">実行者</Label>
              <Select value={recordFormData.completedBy} onValueChange={(value) => setRecordFormData({ ...recordFormData, completedBy: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="実行者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.group === '家族').map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recordRating">評価（1-5）</Label>
              <Select value={recordFormData.rating.toString()} onValueChange={(value) => setRecordFormData({ ...recordFormData, rating: parseInt(value) })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}つ星
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recordNotes">メモ（任意）</Label>
              <Textarea
                id="recordNotes"
                value={recordFormData.notes}
                onChange={(e) => setRecordFormData({ ...recordFormData, notes: e.target.value })}
                placeholder="メモやコメント"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddRecordOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleAddRecord} className="flex-1">
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}