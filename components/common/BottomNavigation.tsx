'use client';

import { Home, List, Calendar, ClipboardList, Settings, ChefHat } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: any) => void;
}

export function BottomNavigation({ currentView, onViewChange }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: 'ホーム', id: 'dashboard' },
    { 
      icon: List, 
      label: '家計', 
      id: 'finance',
      submenu: [
        { id: 'expenses', label: '支出一覧' },
        { id: 'expense-management', label: '支出管理' },
        { id: 'income', label: '入金管理' },
        { id: 'history', label: '履歴' }
      ]
    },
    { 
      icon: Calendar, 
      label: '予定', 
      id: 'planning',
      submenu: [
        { id: 'events', label: 'イベント' }
      ]
    },
    { icon: ClipboardList, label: '家事', id: 'housework' },
    { icon: ChefHat, label: '料理', id: 'recipes' },
    { 
      icon: Settings, 
      label: '管理', 
      id: 'management',
      submenu: [
        { id: 'categories', label: 'カテゴリ' },
        { id: 'people', label: '人の管理' }
      ]
    },
  ];

  const isActive = (item: any) => {
    if (item.submenu) {
      return item.submenu.some((sub: any) => sub.id === currentView);
    }
    return currentView === item.id;
  };

  // ページ遷移の処理
  const handleNavigation = (view: string) => {
    switch (view) {
      case 'dashboard':
        router.push('/dashboard');
        break;
      case 'expenses':
        router.push('/household?view=expenses');
        break;
      case 'expense-management':
        router.push('/household?view=expense-management');
        break;
      case 'income':
        router.push('/household?view=income');
        break;
      case 'history':
        router.push('/household?view=history');
        break;
      case 'events':
        router.push('/schedule');
        break;
      case 'housework':
        router.push('/housework');
        break;
      case 'recipes':
        router.push('/recipe');
        break;
      case 'categories':
        router.push('/household?view=categories');
        break;
      case 'people':
        router.push('/management');
        break;
      default:
        break;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-pb">
      <div className="grid grid-cols-6 h-14 md:h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          
          if (item.submenu) {
            return (
              <DropdownMenu key={item.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex flex-col items-center justify-center gap-0.5 md:gap-1 transition-colors px-1 ${
                      active 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs font-medium leading-none">{item.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="mb-2">
                  <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {item.submenu.map((subItem) => (
                    <DropdownMenuItem
                      key={subItem.id}
                      onClick={() => handleNavigation(subItem.id)}
                      className={currentView === subItem.id ? 'bg-blue-50 text-blue-700' : ''}
                    >
                      {subItem.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 md:gap-1 transition-colors px-1 ${
                active 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}