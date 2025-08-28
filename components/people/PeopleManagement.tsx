'use client';

import { Users, Plus, Edit, Gift, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import type { Person } from '@/app/page';

interface PeopleManagementProps {
  people: Person[];
  onAddPerson: () => void;
  onEditPerson: (person: Person) => void;
}

const groupColors: Record<string, string> = {
  '家族': 'bg-blue-100 text-blue-800',
  '友人': 'bg-green-100 text-green-800',
  '会社': 'bg-purple-100 text-purple-800',
  '親戚': 'bg-yellow-100 text-yellow-800',
  'その他': 'bg-gray-100 text-gray-800',
};

export function PeopleManagement({ people, onAddPerson, onEditPerson }: PeopleManagementProps) {
  // Group people by group
  const groupedPeople = people.reduce((acc, person) => {
    if (!acc[person.group]) {
      acc[person.group] = [];
    }
    acc[person.group].push(person);
    return acc;
  }, {} as Record<string, Person[]>);

  // Get upcoming birthdays
  const upcomingBirthdays = people
    .filter(person => person.birthday)
    .map(person => {
      const birthday = parseISO(person.birthday!);
      const thisYear = new Date().getFullYear();
      const thisYearBirthday = new Date(thisYear, birthday.getMonth(), birthday.getDate());
      const nextYearBirthday = new Date(thisYear + 1, birthday.getMonth(), birthday.getDate());
      
      const nextBirthday = thisYearBirthday >= new Date() ? thisYearBirthday : nextYearBirthday;
      
      return {
        ...person,
        nextBirthday,
        daysUntil: Math.ceil((nextBirthday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  const getBirthdayStatus = (daysUntil: number) => {
    if (daysUntil === 0) return { text: '今日！', color: 'bg-red-100 text-red-800' };
    if (daysUntil === 1) return { text: '明日', color: 'bg-orange-100 text-orange-800' };
    if (daysUntil <= 7) return { text: `${daysUntil}日後`, color: 'bg-yellow-100 text-yellow-800' };
    if (daysUntil <= 30) return { text: `${daysUntil}日後`, color: 'bg-blue-100 text-blue-800' };
    return { text: `${daysUntil}日後`, color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="space-y-6">
      {/* Upcoming Birthdays */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Gift className="w-5 h-5 text-pink-600" />
            近日の誕生日
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBirthdays.length === 0 ? (
            <p className="text-gray-500 text-center py-4">近日の誕生日はありません</p>
          ) : (
            <div className="space-y-3">
              {upcomingBirthdays.map((person) => {
                const status = getBirthdayStatus(person.daysUntil);
                return (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full flex items-center justify-center">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{person.name}</h3>
                        <p className="text-sm text-gray-600">
                          {format(person.nextBirthday, 'M月d日')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={groupColors[person.group] || 'bg-gray-100 text-gray-800'}>
                        {person.group}
                      </Badge>
                      <Badge className={status.color}>
                        {status.text}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* People by Group */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-5 h-5 text-blue-600" />
              人の管理
            </CardTitle>
            <Button onClick={onAddPerson}>
              <Plus className="w-4 h-4 mr-2" />
              人を追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedPeople).map(([group, groupPeople]) => (
              <div key={group}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Badge className={groupColors[group] || 'bg-gray-100 text-gray-800'}>
                    {group}
                  </Badge>
                  <span className="text-sm text-gray-500">({groupPeople.length}人)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupPeople.map((person) => (
                    <div key={person.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{person.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditPerson(person)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                      {person.birthday && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(person.birthday), 'M月d日')}
                        </div>
                      )}
                      {person.notes && (
                        <p className="text-sm text-gray-600 bg-white p-2 rounded border">
                          {person.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}