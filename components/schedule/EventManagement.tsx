'use client';

import { useState } from 'react';
import { format, isSameMonth, isAfter, isBefore, addMonths } from 'date-fns';
import { Calendar, Plus, Edit, Users, DollarSign, Clock, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AmountInput } from '@/components/household/AmountInput';
import type { Event, Person } from '@/app/page';

interface EventManagementProps {
  events: Event[];
  people: Person[];
  currentMonth: Date;
  onUpdateEvents: (events: Event[]) => void;
}

const statusConfig = {
  planned: { icon: Clock, color: 'bg-blue-100 text-blue-800', label: '予定' },
  completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: '完了' },
  cancelled: { icon: X, color: 'bg-red-100 text-red-800', label: 'キャンセル' }
};

const categoryColors: Record<string, string> = {
  '年中行事': 'bg-purple-100 text-purple-800',
  '誕生日': 'bg-pink-100 text-pink-800',
  '旅行': 'bg-blue-100 text-blue-800',
  '記念日': 'bg-yellow-100 text-yellow-800',
  'その他': 'bg-gray-100 text-gray-800',
};

const eventCategories = ['年中行事', '誕生日', '旅行', '記念日', 'その他'];

export function EventManagement({
  events,
  people,
  currentMonth,
  onUpdateEvents
}: EventManagementProps) {
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [eventFormData, setEventFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    participants: [] as string[],
    estimatedCost: '',
    actualCost: '',
    status: 'planned' as 'planned' | 'completed' | 'cancelled',
    notes: ''
  });

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const currentMonthEvents = events.filter(event => 
    isSameMonth(new Date(event.date), currentMonth)
  );

  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    const threeMonthsLater = addMonths(new Date(), 3);
    return isAfter(eventDate, new Date()) && isBefore(eventDate, threeMonthsLater) && event.status === 'planned';
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventsByCategory = events.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  const totalEstimatedCost = upcomingEvents.reduce((sum, event) => sum + (event.estimatedCost || 0), 0);
  const currentMonthActualCost = currentMonthEvents.reduce((sum, event) => sum + (event.actualCost || 0), 0);

  const handleAddEvent = () => {
    if (!eventFormData.name || !eventFormData.date || !eventFormData.category) return;

    const newEvent: Event = {
      id: Date.now().toString(),
      name: eventFormData.name,
      date: eventFormData.date,
      category: eventFormData.category,
      description: eventFormData.description || undefined,
      participants: eventFormData.participants,
      estimatedCost: eventFormData.estimatedCost ? parseInt(eventFormData.estimatedCost) : undefined,
      actualCost: eventFormData.actualCost ? parseInt(eventFormData.actualCost) : undefined,
      status: eventFormData.status,
      notes: eventFormData.notes || undefined
    };

    onUpdateEvents([...events, newEvent]);
    resetForm();
    setIsAddEventOpen(false);
  };

  const handleEditEvent = () => {
    if (!editingEvent || !eventFormData.name || !eventFormData.date || !eventFormData.category) return;

    const updatedEvent: Event = {
      ...editingEvent,
      name: eventFormData.name,
      date: eventFormData.date,
      category: eventFormData.category,
      description: eventFormData.description || undefined,
      participants: eventFormData.participants,
      estimatedCost: eventFormData.estimatedCost ? parseInt(eventFormData.estimatedCost) : undefined,
      actualCost: eventFormData.actualCost ? parseInt(eventFormData.actualCost) : undefined,
      status: eventFormData.status,
      notes: eventFormData.notes || undefined
    };

    onUpdateEvents(events.map(e => e.id === editingEvent.id ? updatedEvent : e));
    setIsEditEventOpen(false);
    setEditingEvent(null);
  };

  const openEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEventFormData({
      name: event.name,
      date: event.date,
      category: event.category,
      description: event.description || '',
      participants: event.participants,
      estimatedCost: event.estimatedCost?.toString() || '',
      actualCost: event.actualCost?.toString() || '',
      status: event.status,
      notes: event.notes || ''
    });
    setIsEditEventOpen(true);
  };

  const resetForm = () => {
    setEventFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      participants: [],
      estimatedCost: '',
      actualCost: '',
      status: 'planned',
      notes: ''
    });
  };

  const handleParticipantChange = (personId: string, checked: boolean) => {
    if (checked) {
      setEventFormData({
        ...eventFormData,
        participants: [...eventFormData.participants, personId]
      });
    } else {
      setEventFormData({
        ...eventFormData,
        participants: eventFormData.participants.filter(id => id !== personId)
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="w-5 h-5 text-purple-600" />
              イベント管理
            </CardTitle>
            <Button onClick={() => setIsAddEventOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              イベントを追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upcoming">近日予定</TabsTrigger>
              <TabsTrigger value="current">今月</TabsTrigger>
              <TabsTrigger value="categories">カテゴリ別</TabsTrigger>
              <TabsTrigger value="budget">予算管理</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">今後3ヶ月の予定</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-purple-700">予定イベント数</p>
                    <p className="text-2xl font-bold text-purple-900">{upcomingEvents.length}件</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">予算合計</p>
                    <p className="text-2xl font-bold text-purple-900">
                      ¥{totalEstimatedCost.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">今後3ヶ月の予定はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const config = statusConfig[event.status];
                    const Icon = config.icon;
                    const daysUntil = Math.ceil((new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={event.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900">{event.name}</h4>
                              <Badge className={categoryColors[event.category] || 'bg-gray-100 text-gray-800'}>
                                {event.category}
                              </Badge>
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(event.date), 'M/d')}
                                <span className="text-blue-600">({daysUntil}日後)</span>
                              </div>
                              {event.participants.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {event.participants.length}人
                                </div>
                              )}
                              {event.estimatedCost && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  ¥{event.estimatedCost.toLocaleString()}
                                </div>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                            )}
                            {event.notes && (
                              <p className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2">
                                {event.notes}
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => openEditEvent(event)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="current" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  {format(currentMonth, 'yyyy年M月')}のイベント
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700">イベント数</p>
                    <p className="text-2xl font-bold text-blue-900">{currentMonthEvents.length}件</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">実際の支出</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ¥{currentMonthActualCost.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {currentMonthEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">今月のイベントはありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentMonthEvents
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((event) => {
                      const config = statusConfig[event.status];
                      const Icon = config.icon;
                      
                      return (
                        <div key={event.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-gray-900">{event.name}</h4>
                                <Badge className={categoryColors[event.category] || 'bg-gray-100 text-gray-800'}>
                                  {event.category}
                                </Badge>
                                <Badge className={config.color}>
                                  <Icon className="w-3 h-3 mr-1" />
                                  {config.label}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(event.date), 'M/d')}
                                </div>
                                {event.participants.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {event.participants.map(id => getPersonName(id)).join(', ')}
                                  </div>
                                )}
                                {event.estimatedCost && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    予算: ¥{event.estimatedCost.toLocaleString()}
                                  </div>
                                )}
                                {event.actualCost && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    実費: ¥{event.actualCost.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => openEditEvent(event)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>
                      {category}
                    </Badge>
                    <span className="text-sm text-gray-500">({categoryEvents.length}件)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryEvents
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 6)
                      .map((event) => {
                        const config = statusConfig[event.status];
                        const Icon = config.icon;
                        
                        return (
                          <div key={event.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{event.name}</h4>
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(event.date), 'yyyy/M/d')}
                              </div>
                              {event.estimatedCost && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  ¥{event.estimatedCost.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="budget" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">予算 vs 実費</h3>
                  <div className="space-y-3">
                    {Object.entries(eventsByCategory).map(([category, categoryEvents]) => {
                      const totalEstimated = categoryEvents.reduce((sum, e) => sum + (e.estimatedCost || 0), 0);
                      const totalActual = categoryEvents.reduce((sum, e) => sum + (e.actualCost || 0), 0);
                      
                      if (totalEstimated === 0 && totalActual === 0) return null;
                      
                      return (
                        <div key={category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-green-800">{category}</span>
                            <span className="text-green-700">
                              {totalActual > 0 && totalEstimated > 0 
                                ? `${((totalActual / totalEstimated) * 100).toFixed(0)}%`
                                : '-'
                              }
                            </span>
                          </div>
                          <div className="text-xs text-green-600">
                            予算: ¥{totalEstimated.toLocaleString()} / 
                            実費: ¥{totalActual.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-orange-900 mb-3">今後の予算計画</h3>
                  <div className="space-y-2">
                    {upcomingEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex justify-between items-center p-2 bg-white rounded border">
                        <div>
                          <span className="font-medium text-gray-900">{event.name}</span>
                          <p className="text-xs text-gray-600">
                            {format(new Date(event.date), 'M/d')}
                          </p>
                        </div>
                        <span className="font-bold text-orange-900">
                          ¥{(event.estimatedCost || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {upcomingEvents.length > 5 && (
                      <p className="text-xs text-orange-700 text-center">
                        他{upcomingEvents.length - 5}件...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Event Modal */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>イベントを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="eventName">イベント名</Label>
              <Input
                id="eventName"
                value={eventFormData.name}
                onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                placeholder="例: 太郎の七五三"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eventDate">日付</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={eventFormData.date}
                  onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="eventCategory">カテゴリ</Label>
                <Select value={eventFormData.category} onValueChange={(value) => setEventFormData({ ...eventFormData, category: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="eventDescription">説明（任意）</Label>
              <Textarea
                id="eventDescription"
                value={eventFormData.description}
                onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                placeholder="イベントの詳細"
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label>参加者（複数選択可）</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`participant-${person.id}`}
                      checked={eventFormData.participants.includes(person.id)}
                      onCheckedChange={(checked) => handleParticipantChange(person.id, checked as boolean)}
                    />
                    <Label htmlFor={`participant-${person.id}`} className="text-sm">
                      {person.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AmountInput
                label="予算"
                value={eventFormData.estimatedCost}
                onChange={(value) => setEventFormData({ ...eventFormData, estimatedCost: value })}
                quickAmounts={[1000, 5000, 10000]}
              />
              <AmountInput
                label="実費"
                value={eventFormData.actualCost}
                onChange={(value) => setEventFormData({ ...eventFormData, actualCost: value })}
                quickAmounts={[1000, 5000, 10000]}
              />
            </div>

            <div>
              <Label htmlFor="eventStatus">ステータス</Label>
              <Select value={eventFormData.status} onValueChange={(value) => setEventFormData({ ...eventFormData, status: value as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">予定</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="eventNotes">メモ（任意）</Label>
              <Textarea
                id="eventNotes"
                value={eventFormData.notes}
                onChange={(e) => setEventFormData({ ...eventFormData, notes: e.target.value })}
                placeholder="メモやコメント"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddEventOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleAddEvent} className="flex-1">
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Modal */}
      <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>イベントを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editEventName">イベント名</Label>
              <Input
                id="editEventName"
                value={eventFormData.name}
                onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                placeholder="例: 太郎の七五三"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editEventDate">日付</Label>
                <Input
                  id="editEventDate"
                  type="date"
                  value={eventFormData.date}
                  onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editEventCategory">カテゴリ</Label>
                <Select value={eventFormData.category} onValueChange={(value) => setEventFormData({ ...eventFormData, category: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="editEventDescription">説明（任意）</Label>
              <Textarea
                id="editEventDescription"
                value={eventFormData.description}
                onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                placeholder="イベントの詳細"
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label>参加者（複数選択可）</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-participant-${person.id}`}
                      checked={eventFormData.participants.includes(person.id)}
                      onCheckedChange={(checked) => handleParticipantChange(person.id, checked as boolean)}
                    />
                    <Label htmlFor={`edit-participant-${person.id}`} className="text-sm">
                      {person.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AmountInput
                label="予算"
                value={eventFormData.estimatedCost}
                onChange={(value) => setEventFormData({ ...eventFormData, estimatedCost: value })}
                quickAmounts={[1000, 5000, 10000]}
              />
              <AmountInput
                label="実費"
                value={eventFormData.actualCost}
                onChange={(value) => setEventFormData({ ...eventFormData, actualCost: value })}
                quickAmounts={[1000, 5000, 10000]}
              />
            </div>

            <div>
              <Label htmlFor="editEventStatus">ステータス</Label>
              <Select value={eventFormData.status} onValueChange={(value) => setEventFormData({ ...eventFormData, status: value as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">予定</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editEventNotes">メモ（任意）</Label>
              <Textarea
                id="editEventNotes"
                value={eventFormData.notes}
                onChange={(e) => setEventFormData({ ...eventFormData, notes: e.target.value })}
                placeholder="メモやコメント"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditEventOpen(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleEditEvent} className="flex-1">
                更新
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}