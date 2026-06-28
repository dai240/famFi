'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const router = useRouter();

  // 現在のビューに基づいてアクティブなメニューを判定
  const isActiveMenu = (menuId: string) => {
    switch (menuId) {
      case 'dashboard':
        return currentView === 'dashboard';
      case 'household':
        return ['expenses', 'expense-management', 'income', 'history', 'categories'].includes(currentView);
      case 'schedule':
        return ['events', 'milestones'].includes(currentView);
      case 'housework':
        return currentView === 'housework';
      case 'recipes':
        return currentView === 'recipes';
      case 'management':
        return ['categories', 'people', 'recurring-expenses'].includes(currentView);
      default:
        return false;
    }
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
      case 'categories':
        router.push('/household?view=categories');
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
      case 'people':
        router.push('/management');
        break;
      default:
        break;
    }
  };

  return (
    <nav className="flex items-center gap-6">
      <Button
        variant={isActiveMenu('dashboard') ? 'default' : 'ghost'}
        onClick={() => handleNavigation('dashboard')}
        className="text-sm"
      >
        ダッシュボード
      </Button>
      
      <div className="relative group">
        <Button variant="ghost" className="text-sm">
          家計
        </Button>
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="py-1">
            <button
              onClick={() => handleNavigation('expenses')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'expenses' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              支出一覧
            </button>
            <button
              onClick={() => handleNavigation('expense-management')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'expense-management' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              支出管理
            </button>
            <button
              onClick={() => handleNavigation('income')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'income' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              入金管理
            </button>
            <button
              onClick={() => handleNavigation('history')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'history' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              履歴
            </button>
          </div>
        </div>
      </div>

      <div className="relative group">
        <Button variant="ghost" className="text-sm">
          予定
        </Button>
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="py-1">
            <button
              onClick={() => handleNavigation('events')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'events' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              イベント
            </button>
          </div>
        </div>
      </div>

      <Button
        variant={isActiveMenu('housework') ? 'default' : 'ghost'}
        onClick={() => handleNavigation('housework')}
        className="text-sm"
      >
        家事
      </Button>

      <Button
        variant={isActiveMenu('recipes') ? 'default' : 'ghost'}
        onClick={() => handleNavigation('recipes')}
        className="text-sm"
      >
        料理
      </Button>

      <div className="relative group">
        <Button variant="ghost" className="text-sm">
          管理
        </Button>
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="py-1">
            <button
              onClick={() => handleNavigation('categories')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'categories' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              カテゴリ
            </button>
            <button
              onClick={() => handleNavigation('people')}
              className={`block w-full text-left px-4 py-2 text-sm ${
                currentView === 'people' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              人の管理
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}