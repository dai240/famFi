'use client';

import { useState } from 'react';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Import all components
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { BottomNavigation } from '@/components/common/BottomNavigation';
import { MonthlyOverview } from '@/components/dashboard/MonthlyOverview';
import { ExpenseCategories } from '@/components/household/ExpenseCategories';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SavingsGoals } from '@/components/household/SavingsGoals';
import { UpcomingMilestones } from '@/components/schedule/UpcomingMilestones';
import { ExpenseList } from '@/components/household/ExpenseList';
import { ExpenseManagement } from '@/components/household/ExpenseManagement';
import { IncomeManagement } from '@/components/household/IncomeManagement';
import { ExpenseHistory } from '@/components/household/ExpenseHistory';
import { CategoryManagement } from '@/components/household/CategoryManagement';
import { PeopleManagement } from '@/components/people/PeopleManagement';
import { EventManagement } from '@/components/schedule/EventManagement';
import { HouseworkManagement } from '@/components/common/HouseworkManagement';
import { RecipeManagement } from '@/components/recipe/RecipeManagement';

// Import modals
import { AddExpenseModal } from '@/components/household/AddExpenseModal';
import { AddIncomeModal } from '@/components/household/AddIncomeModal';
import { AddPersonModal } from '@/components/people/AddPersonModal';
import { AddRecurringExpenseModal } from '@/components/household/AddRecurringExpenseModal';
import { EditExpenseModal } from '@/components/household/EditExpenseModal';
import { EditRecurringExpenseModal } from '@/components/household/EditRecurringExpenseModal';
import { ExpenseDetailModal } from '@/components/household/ExpenseDetailModal';
import { ConfirmExpenseModal } from '@/components/household/ConfirmExpenseModal';
import { MonthlyReflectionModal } from '@/components/schedule/MonthlyReflectionModal';

// Types
export interface Person {
  id: string;
  name: string;
  group: string;
  birthday?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  subcategories: string[];
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  subcategory: string;
  description: string;
  comment?: string;
  paymentMethod: string;
  paidBy: string;
  beneficiaries: string[];
}

export interface Income {
  id: string;
  date: string;
  amount: number;
  description: string;
  personId: string;
  comment?: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  type: 'fixed' | 'variable';
  amount?: number;
  description: string;
  comment?: string;
  paymentMethod: string;
  paidBy: string;
  beneficiaries: string[];
  personId: string; // 支払い者のID
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MonthlyExpenseStatus {
  id: string;
  recurringExpenseId: string;
  month: string; // YYYY-MM format
  status: 'pending' | 'confirmed' | 'skipped';
  amount?: number;
  confirmedDate?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  category: string;
  description?: string;
  participants: string[];
  estimatedCost?: number;
  actualCost?: number;
  status: 'planned' | 'completed' | 'cancelled';
  notes?: string;
}

export interface HouseworkTask {
  id: string;
  name: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  assignedTo: string;
  description?: string;
  isActive: boolean;
}

export interface HouseworkRecord {
  id: string;
  taskId: string;
  date: string;
  completedBy: string;
  notes?: string;
  rating?: number;
}

export interface MonthlyReflection {
  month: string; // YYYY-MM format
  reflection: string;
  goals: string;
  improvements: string;
}

export interface MonthlyConfirmation {
  month: string; // YYYY-MM format
  isConfirmed: boolean;
  confirmedDate?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  servings: number;
  cookingTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  imageUrl?: string;
  duration?: number; // minutes
}

export interface CookingRecord {
  id: string;
  recipeId: string;
  date: string;
  cookedBy: string;
  servings?: number; // 実際に作った人数分
  rating?: number; // 1-5の評価
  notes?: string;
  photos?: string[]; // 作った料理の写真URL
}

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentView, setCurrentView] = useState('dashboard');

  // Modal states
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddRecurringExpenseOpen, setIsAddRecurringExpenseOpen] = useState(false);
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [isEditRecurringExpenseOpen, setIsEditRecurringExpenseOpen] = useState(false);
  const [isExpenseDetailOpen, setIsExpenseDetailOpen] = useState(false);
  const [isConfirmExpenseOpen, setIsConfirmExpenseOpen] = useState(false);
  const [isMonthlyReflectionOpen, setIsMonthlyReflectionOpen] = useState(false);

  // Selected items for editing
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState<RecurringExpense | null>(null);
  const [selectedMonthlyStatus, setSelectedMonthlyStatus] = useState<MonthlyExpenseStatus | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Sample data
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: '田中太郎', group: '家族', birthday: '1985-05-15' },
    { id: '2', name: '田中花子', group: '家族', birthday: '1987-08-22' },
    { id: '3', name: '田中一郎', group: '家族', birthday: '2015-03-10' },
    { id: '4', name: '田中二郎', group: '家族', birthday: '2018-11-05' }
  ]);

  const [categories, setCategories] = useState<Category[]>([
    {
      id: '1',
      name: '住居費',
      color: '#3B82F6',
      subcategories: ['家賃', '管理費', '修繕費', '光熱費']
    },
    {
      id: '2',
      name: '食費',
      color: '#10B981',
      subcategories: ['食材', '外食', '弁当', 'お菓子']
    },
    {
      id: '3',
      name: '育児・教育',
      color: '#F59E0B',
      subcategories: ['保育園', '習い事', '教材', '医療費']
    },
    {
      id: '4',
      name: '保険・医療',
      color: '#EF4444',
      subcategories: ['生命保険', '医療保険', '病院', '薬']
    },
    {
      id: '5',
      name: 'プレゼント・お祝い',
      color: '#8B5CF6',
      subcategories: ['誕生日', '記念日', 'お祝い', 'ギフト']
    },
    {
      id: '6',
      name: 'その他',
      color: '#6B7280',
      subcategories: ['雑費', '交通費', '娯楽', 'その他']
    }
  ]);

  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: '1',
      date: '2024-07-10',
      amount: 80000,
      category: '住居費',
      subcategory: '家賃',
      description: '月額家賃',
      paymentMethod: 'クレジットカード',
      paidBy: '1',
      beneficiaries: ['1', '2', '3', '4'],
      comment: 'コメントあり'
    },
    {
      id: '2',
      date: '2024-07-15',
      amount: 25000,
      category: '食費',
      subcategory: '食材',
      description: '週末の買い物',
      paymentMethod: '現金',
      paidBy: '2',
      beneficiaries: ['1', '2', '3', '4']
    }
  ]);

  const [income, setIncome] = useState<Income[]>([
    {
      id: '1',
      date: '2024-07-25',
      amount: 300000,
      description: '給与',
      personId: '1'
    },
    {
      id: '2',
      date: '2024-07-25',
      amount: 200000,
      description: 'パート代',
      personId: '2'
    }
  ]);

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([
    {
      id: '1',
      name: '家賃',
      category: '住居費',
      subcategory: '家賃',
      type: 'fixed',
      amount: 80000,
      description: '月額家賃',
      paymentMethod: 'クレジットカード',
      paidBy: '1',
      beneficiaries: ['1', '2', '3', '4'],
      personId: '1',
      isActive: true,
      comment: 'コメントあり',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: '電気代',
      category: '住居費',
      subcategory: '光熱費',
      type: 'variable',
      description: '電気代',
      paymentMethod: 'クレジットカード',
      paidBy: '1',
      beneficiaries: ['1', '2', '3', '4'],
      personId: '1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  const [monthlyExpenseStatuses, setMonthlyExpenseStatuses] = useState<MonthlyExpenseStatus[]>([
    {
      id: '1',
      recurringExpenseId: '1',
      month: '2024-07',
      status: 'confirmed',
      amount: 80000,
      confirmedDate: '2024-07-01'
    }
  ]);

  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      name: '太郎の七五三',
      date: '2024-11-15',
      category: '年中行事',
      description: '神社での七五三のお参り',
      participants: ['1', '2', '3'],
      estimatedCost: 50000,
      status: 'planned'
    }
  ]);

  const [houseworkTasks, setHouseworkTasks] = useState<HouseworkTask[]>([
    {
      id: '1',
      name: '掃除機かけ',
      category: '掃除',
      frequency: 'weekly',
      assignedTo: '1',
      description: 'リビングと寝室の掃除機かけ',
      isActive: true
    }
  ]);

  const [houseworkRecords, setHouseworkRecords] = useState<HouseworkRecord[]>([
    {
      id: '1',
      taskId: '1',
      date: '2024-07-15',
      completedBy: '1',
      rating: 5
    }
  ]);

  const [monthlyReflections, setMonthlyReflections] = useState<MonthlyReflection[]>([]);
  const [monthlyConfirmations, setMonthlyConfirmations] = useState<MonthlyConfirmation[]>([]);

  // Recipe data
  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: '1',
      title: '無限もやし',
      description: '野菜が苦手な子供でもパクパク食べれる、中華味のサラダです。',
      imageUrl: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
      servings: 4,
      cookingTime: 15,
      difficulty: 'easy',
      category: '副菜',
      tags: ['簡単', '節約', '野菜'],
      ingredients: [
        { id: '1', name: 'もやし', amount: '1', unit: '袋' },
        { id: '2', name: 'きゅうり', amount: '1', unit: '本' },
        { id: '3', name: 'ツナ缶', amount: '1', unit: '缶' },
        { id: '4', name: 'しょうゆ', amount: '小さじ2', unit: '' },
        { id: '5', name: '酢', amount: '小さじ2', unit: '' },
        { id: '6', name: '砂糖', amount: '小さじ2', unit: '' },
        { id: '7', name: '鶏がらスープ', amount: '小さじ2', unit: '' }
      ],
      steps: [
        {
          id: '1',
          stepNumber: 1,
          instruction: 'もやしは洗って耐熱ボリ袋に入れてレンジで600W2分チンする',
          duration: 2
        },
        {
          id: '2',
          stepNumber: 2,
          instruction: 'きゅうりを千切りし、塩をふって5分くらい置く。5分後、しぼって水気をきる',
          duration: 5
        },
        {
          id: '3',
          stepNumber: 3,
          instruction: 'チンしたもやしは軽く絞んで水気をきる',
          duration: 1
        },
        {
          id: '4',
          stepNumber: 4,
          instruction: 'きゅうり、もやし、ツナ缶をボウルに入れ、調味料を全部入れて混ぜたらできあがり',
          duration: 2
        }
      ],
      notes: '冷蔵庫で冷やすとより美味しくなります。',
      createdBy: '2',
      createdAt: '2024-07-01T10:00:00Z',
      updatedAt: '2024-07-01T10:00:00Z',
      isFavorite: true
    },
    {
      id: '2',
      title: 'チキンカレー',
      description: 'スパイスから作る本格的なチキンカレーです。',
      imageUrl: 'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg',
      servings: 6,
      cookingTime: 60,
      difficulty: 'medium',
      category: '主菜',
      tags: ['スパイス', '本格', '鶏肉'],
      ingredients: [
        { id: '1', name: '鶏もも肉', amount: '600', unit: 'g' },
        { id: '2', name: '玉ねぎ', amount: '2', unit: '個' },
        { id: '3', name: 'トマト缶', amount: '1', unit: '缶' },
        { id: '4', name: 'にんにく', amount: '3', unit: '片' },
        { id: '5', name: 'しょうが', amount: '1', unit: '片' },
        { id: '6', name: 'カレー粉', amount: '大さじ3', unit: '' },
        { id: '7', name: 'ココナッツミルク', amount: '400', unit: 'ml' }
      ],
      steps: [
        {
          id: '1',
          stepNumber: 1,
          instruction: '鶏肉を一口大に切り、塩胡椒で下味をつける',
          duration: 10
        },
        {
          id: '2',
          stepNumber: 2,
          instruction: '玉ねぎをみじん切りにし、にんにく・しょうがをすりおろす',
          duration: 15
        },
        {
          id: '3',
          stepNumber: 3,
          instruction: 'フライパンで鶏肉を焼き色がつくまで炒める',
          duration: 10
        },
        {
          id: '4',
          stepNumber: 4,
          instruction: '玉ねぎを加えて透明になるまで炒め、にんにく・しょうがを加える',
          duration: 10
        },
        {
          id: '5',
          stepNumber: 5,
          instruction: 'カレー粉を加えて香りが立つまで炒め、トマト缶とココナッツミルクを加えて煮込む',
          duration: 20
        }
      ],
      notes: 'お好みでガラムマサラを最後に加えると香りが良くなります。',
      createdBy: '1',
      createdAt: '2024-07-05T15:30:00Z',
      updatedAt: '2024-07-05T15:30:00Z',
      isFavorite: false
    }
  ]);

  // Cooking records data
  const [cookingRecords, setCookingRecords] = useState<CookingRecord[]>([
    {
      id: '1',
      recipeId: '1',
      date: '2024-07-20',
      cookedBy: '2',
      servings: 4,
      rating: 5,
      notes: '子供たちも喜んで食べてくれました！'
    },
    {
      id: '2',
      recipeId: '1',
      date: '2024-07-25',
      cookedBy: '1',
      servings: 4,
      rating: 4,
      notes: '簡単で美味しい'
    },
    {
      id: '3',
      recipeId: '2',
      date: '2024-07-18',
      cookedBy: '2',
      servings: 6,
      rating: 5,
      notes: 'スパイスの香りが最高でした'
    }
  ]);

  // Event handlers
  const handleAddExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString()
    };
    setExpenses([...expenses, newExpense]);
    setIsAddExpenseOpen(false);
    toast.success('支出を追加しました');
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenses(expenses.map(e => e.id === expense.id ? expense : e));
    setIsEditExpenseOpen(false);
    setSelectedExpense(null);
    toast.success('支出を更新しました');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
    setIsExpenseDetailOpen(false);
    setSelectedExpense(null);
    toast.success('支出を削除しました');
  };

  const handleAddIncome = (inc: Omit<Income, 'id'>) => {
    const newIncome: Income = {
      ...inc,
      id: Date.now().toString()
    };
    setIncome([...income, newIncome]);
    setIsAddIncomeOpen(false);
    toast.success('入金を追加しました');
  };

  const handleAddPerson = (person: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      ...person,
      id: Date.now().toString()
    };
    setPeople([...people, newPerson]);
    setIsAddPersonOpen(false);
    toast.success('人を追加しました');
  };

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setIsAddPersonOpen(true);
  };

  const handleAddRecurringExpense = (expense: Omit<RecurringExpense, 'id'>) => {
    const newExpense: RecurringExpense = {
      ...expense,
      id: Date.now().toString()
    };
    setRecurringExpenses([...recurringExpenses, newExpense]);
    setIsAddRecurringExpenseOpen(false);
    toast.success('定期支出を追加しました');
  };

  const handleEditRecurringExpense = (expense: RecurringExpense) => {
    setRecurringExpenses(recurringExpenses.map(e => e.id === expense.id ? expense : e));
    setIsEditRecurringExpenseOpen(false);
    setSelectedRecurringExpense(null);
    toast.success('定期支出を更新しました');
  };

  const handleToggleRecurringExpenseStatus = (monthlyStatus: MonthlyExpenseStatus) => {
    const recurringExpense = recurringExpenses.find(re => re.id === monthlyStatus.recurringExpenseId);
    if (!recurringExpense) return;

    setSelectedMonthlyStatus(monthlyStatus);
    setSelectedRecurringExpense(recurringExpense);
    setIsConfirmExpenseOpen(true);
  };

  const handleConfirmExpense = (monthlyStatus: MonthlyExpenseStatus, amount?: number) => {
    const recurringExpense = recurringExpenses.find(re => re.id === monthlyStatus.recurringExpenseId);
    if (!recurringExpense) return;

    const finalAmount = amount || recurringExpense.amount || 0;

    if (monthlyStatus.status === 'confirmed') {
      // Remove from confirmed status
      setMonthlyExpenseStatuses(monthlyExpenseStatuses.filter(s => s.id !== monthlyStatus.id));
      toast.success('支出の確定を解除しました');
    } else {
      // Confirm the expense
      const updatedStatus: MonthlyExpenseStatus = {
        ...monthlyStatus,
        status: 'confirmed',
        amount: finalAmount,
        confirmedDate: new Date().toISOString().split('T')[0]
      };

      const existingIndex = monthlyExpenseStatuses.findIndex(s => s.id === monthlyStatus.id);
      if (existingIndex >= 0) {
        setMonthlyExpenseStatuses(monthlyExpenseStatuses.map(s => s.id === monthlyStatus.id ? updatedStatus : s));
      } else {
        setMonthlyExpenseStatuses([...monthlyExpenseStatuses, updatedStatus]);
      }

      // Add to regular expenses
      const newExpense: Expense = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        amount: finalAmount,
        category: recurringExpense.category,
        subcategory: recurringExpense.subcategory,
        description: recurringExpense.name,
        comment: recurringExpense.comment,
        paymentMethod: recurringExpense.paymentMethod,
        paidBy: recurringExpense.paidBy,
        beneficiaries: recurringExpense.beneficiaries
      };
      setExpenses([...expenses, newExpense]);
      toast.success('支出を確定しました');
    }

    setIsConfirmExpenseOpen(false);
    setSelectedMonthlyStatus(null);
    setSelectedRecurringExpense(null);
  };

  const handleOpenExpenseDetail = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsExpenseDetailOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditExpenseOpen(true);
  };

  const handleOpenEditRecurringExpense = (expense: RecurringExpense) => {
    setSelectedRecurringExpense(expense);
    setIsEditRecurringExpenseOpen(true);
  };

  const handleSaveMonthlyReflection = (reflection: MonthlyReflection) => {
    const existingIndex = monthlyReflections.findIndex(r => r.month === reflection.month);
    if (existingIndex >= 0) {
      setMonthlyReflections(monthlyReflections.map(r => r.month === reflection.month ? reflection : r));
    } else {
      setMonthlyReflections([...monthlyReflections, reflection]);
    }
    setIsMonthlyReflectionOpen(false);
    toast.success('振り返りを保存しました');
  };

  const handleMonthlyConfirmation = (month: string, isConfirmed: boolean) => {
    const existingIndex = monthlyConfirmations.findIndex(c => c.month === month);
    const confirmation: MonthlyConfirmation = {
      month,
      isConfirmed,
      confirmedDate: isConfirmed ? new Date().toISOString().split('T')[0] : undefined
    };

    if (existingIndex >= 0) {
      setMonthlyConfirmations(monthlyConfirmations.map(c => c.month === month ? confirmation : c));
    } else {
      setMonthlyConfirmations([...monthlyConfirmations, confirmation]);
    }

    toast.success(isConfirmed ? '今月の入力を完了しました' : '入力完了を解除しました');
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <MonthlyOverview
              currentMonth={currentMonth}
              expenses={expenses}
              income={income}
              people={people}
              monthlyReflections={monthlyReflections}
              monthlyConfirmations={monthlyConfirmations}
              onOpenReflection={() => setIsMonthlyReflectionOpen(true)}
              onMonthlyConfirmation={handleMonthlyConfirmation}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ExpenseCategories
                  currentMonth={currentMonth}
                  expenses={expenses}
                  categories={categories}
                />
              </div>
              <div className="space-y-6">
                <QuickActions
                  onAddExpense={() => setIsAddExpenseOpen(true)}
                  onAddIncome={() => setIsAddIncomeOpen(true)}
                />
                <SavingsGoals />
                <UpcomingMilestones />
              </div>
            </div>
          </div>
        );

      case 'expenses':
        return (
          <ExpenseList
            expenses={expenses}
            recurringExpenses={recurringExpenses}
            monthlyExpenseStatuses={monthlyExpenseStatuses}
            currentMonth={currentMonth}
            people={people}
            categories={categories}
            onEditExpense={handleOpenEditExpense}
            onViewExpense={handleOpenExpenseDetail}
            onAddExpense={() => setIsAddExpenseOpen(true)}
            onToggleRecurringExpenseStatus={handleToggleRecurringExpenseStatus}
          />
        );

      case 'expense-management':
        return (
          <ExpenseManagement
            recurringExpenses={recurringExpenses}
            monthlyExpenseStatuses={monthlyExpenseStatuses}
            currentMonth={currentMonth}
            people={people}
            categories={categories}
            onAddRecurringExpense={() => setIsAddRecurringExpenseOpen(true)}
            onEditRecurringExpense={handleOpenEditRecurringExpense}
            onConfirmExpense={handleToggleRecurringExpenseStatus}
          />
        );

      case 'income':
        return (
          <IncomeManagement
            income={income}
            people={people}
            currentMonth={currentMonth}
            onAddIncome={() => setIsAddIncomeOpen(true)}
          />
        );

      case 'history':
        return (
          <ExpenseHistory
            expenses={expenses}
            people={people}
            categories={categories}
            onEditExpense={handleOpenEditExpense}
            onViewExpense={handleOpenExpenseDetail}
          />
        );

      case 'categories':
        return (
          <CategoryManagement
            categories={categories}
            onUpdateCategories={setCategories}
          />
        );

      case 'people':
        return (
          <PeopleManagement
            people={people}
            onAddPerson={() => setIsAddPersonOpen(true)}
            onEditPerson={handleEditPerson}
          />
        );

      case 'events':
        return (
          <EventManagement
            events={events}
            people={people}
            currentMonth={currentMonth}
            onUpdateEvents={setEvents}
          />
        );

      case 'housework':
        return (
          <HouseworkManagement
            tasks={houseworkTasks}
            records={houseworkRecords}
            people={people}
            currentMonth={currentMonth}
            onUpdateTasks={setHouseworkTasks}
            onUpdateRecords={setHouseworkRecords}
          />
        );

      case 'recipes':
        return (
          <RecipeManagement
            recipes={recipes}
            people={people}
            cookingRecords={cookingRecords}
            onUpdateRecipes={setRecipes}
            onUpdateCookingRecords={setCookingRecords}
          />
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">選択されたビューが見つかりません</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-gray-900">家計管理</h1>
                
                <nav className="flex items-center gap-6">
                  <Button
                    variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                    onClick={() => setCurrentView('dashboard')}
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
                          onClick={() => setCurrentView('expenses')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          支出一覧
                        </button>
                        <button
                          onClick={() => setCurrentView('expense-management')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          支出管理
                        </button>
                        <button
                          onClick={() => setCurrentView('income')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          入金管理
                        </button>
                        <button
                          onClick={() => setCurrentView('history')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
                          onClick={() => setCurrentView('events')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          イベント
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant={currentView === 'housework' ? 'default' : 'ghost'}
                    onClick={() => setCurrentView('housework')}
                    className="text-sm"
                  >
                    家事
                  </Button>

                  <Button
                    variant={currentView === 'recipes' ? 'default' : 'ghost'}
                    onClick={() => setCurrentView('recipes')}
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
                          onClick={() => setCurrentView('categories')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          カテゴリ
                        </button>
                        <button
                          onClick={() => setCurrentView('people')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          人の管理
                        </button>
                      </div>
                    </div>
                  </div>
                </nav>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={previousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {format(currentMonth, 'yyyy年M月')}
                  </span>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button onClick={() => setIsAddExpenseOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  支出追加
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Only show on dashboard */}
      {currentView === 'dashboard' && (
        <div className="md:hidden">
          <DashboardHeader 
            currentMonth={currentMonth} 
            onMonthChange={setCurrentMonth}
            currentView={currentView}
            onViewChange={setCurrentView}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <BottomNavigation 
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSave={handleAddExpense}
        people={people}
        categories={categories}
      />

      <AddIncomeModal
        isOpen={isAddIncomeOpen}
        onClose={() => setIsAddIncomeOpen(false)}
        onSave={handleAddIncome}
        people={people}
      />

      <AddPersonModal
        isOpen={isAddPersonOpen}
        onClose={() => {
          setIsAddPersonOpen(false);
          setSelectedPerson(null);
        }}
        onSave={handleAddPerson}
      />

      <AddRecurringExpenseModal
        isOpen={isAddRecurringExpenseOpen}
        onClose={() => setIsAddRecurringExpenseOpen(false)}
        onSave={handleAddRecurringExpense}
        people={people}
        categories={categories}
      />

      <EditExpenseModal
        isOpen={isEditExpenseOpen}
        expense={selectedExpense}
        onClose={() => {
          setIsEditExpenseOpen(false);
          setSelectedExpense(null);
        }}
        onSave={handleEditExpense}
        people={people}
        categories={categories}
      />

      <EditRecurringExpenseModal
        isOpen={isEditRecurringExpenseOpen}
        expense={selectedRecurringExpense}
        onClose={() => {
          setIsEditRecurringExpenseOpen(false);
          setSelectedRecurringExpense(null);
        }}
        onSave={handleEditRecurringExpense}
        people={people}
        categories={categories}
      />

      <ExpenseDetailModal
        isOpen={isExpenseDetailOpen}
        expense={selectedExpense}
        people={people}
        onClose={() => {
          setIsExpenseDetailOpen(false);
          setSelectedExpense(null);
        }}
        onEdit={() => {
          setIsExpenseDetailOpen(false);
          setIsEditExpenseOpen(true);
        }}
        onDelete={handleDeleteExpense}
      />

      <ConfirmExpenseModal
        isOpen={isConfirmExpenseOpen}
        monthlyStatus={selectedMonthlyStatus}
        recurringExpense={selectedRecurringExpense}
        onClose={() => {
          setIsConfirmExpenseOpen(false);
          setSelectedMonthlyStatus(null);
          setSelectedRecurringExpense(null);
        }}
        onConfirm={handleConfirmExpense}
      />

      <MonthlyReflectionModal
        isOpen={isMonthlyReflectionOpen}
        currentMonth={currentMonth}
        existingReflection={monthlyReflections.find(r => r.month === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`)}
        onClose={() => setIsMonthlyReflectionOpen(false)}
        onSave={handleSaveMonthlyReflection}
      />
    </div>
  );
}