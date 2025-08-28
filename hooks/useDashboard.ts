'use client';

import { useState } from 'react';
import type {
  Person,
  Expense,
  Income,
  Category,
  RecurringExpense,
  MonthlyExpenseStatus,
  Event,
  HouseworkTask,
  HouseworkRecord,
  MonthlyReflection,
  MonthlyConfirmation,
  Recipe,
  CookingRecord,
} from '@/app/page';

export function useDashboard() {
  // 基本状態
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentView, setCurrentView] = useState('dashboard');

  // サンプルデータ（app/page.tsxと同じ内容）
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
      comment: 'コメントあり'
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
      personId: '2',
      isActive: true
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
    }
  ]);

  const [cookingRecords, setCookingRecords] = useState<CookingRecord[]>([
    {
      id: '1',
      recipeId: '1',
      date: '2024-07-20',
      cookedBy: '2',
      servings: 4,
      rating: 5,
      notes: '子供たちも喜んで食べてくれました！'
    }
  ]);

  // ハンドラ関数（引数なしのバージョンも追加）
  const handleAddExpense = (expense?: Omit<Expense, 'id'>) => {
    if (expense) {
      const newExpense: Expense = {
        ...expense,
        id: Date.now().toString()
      };
      setExpenses([...expenses, newExpense]);
    } else {
      console.log('Add expense clicked');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenses(expenses.map(e => e.id === expense.id ? expense : e));
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleAddIncome = (inc?: Omit<Income, 'id'>) => {
    if (inc) {
      const newIncome: Income = {
        ...inc,
        id: Date.now().toString()
      };
      setIncome([...income, newIncome]);
    } else {
      console.log('Add income clicked');
    }
  };

  const handleAddPerson = (person: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      ...person,
      id: Date.now().toString()
    };
    setPeople([...people, newPerson]);
  };

  const handleEditPerson = (person: Person) => {
    setPeople(people.map(p => p.id === person.id ? person : p));
  };

  const handleDeletePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
  };

  const handleAddRecurringExpense = (expense?: Omit<RecurringExpense, 'id'>) => {
    if (expense) {
      const newExpense: RecurringExpense = {
        ...expense,
        id: Date.now().toString()
      };
      setRecurringExpenses([...recurringExpenses, newExpense]);
    } else {
      console.log('Add recurring expense clicked');
    }
  };

  const handleEditRecurringExpense = (expense: RecurringExpense) => {
    setRecurringExpenses(recurringExpenses.map(e => e.id === expense.id ? expense : e));
  };

  const handleDeleteRecurringExpense = (id: string) => {
    setRecurringExpenses(recurringExpenses.filter(e => e.id !== id));
  };

  const handleConfirmExpense = (monthlyStatus: MonthlyExpenseStatus, amount?: number) => {
    console.log('Confirm expense:', monthlyStatus, amount);
  };

  const handleAddEvent = (event: Omit<Event, 'id'>) => {
    const newEvent: Event = {
      ...event,
      id: Date.now().toString()
    };
    setEvents([...events, newEvent]);
  };

  const handleEditEvent = (event: Event) => {
    setEvents(events.map(e => e.id === event.id ? event : e));
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const handleAddRecipe = (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecipe: Recipe = {
      ...recipe,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now
    };
    setRecipes([...recipes, newRecipe]);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    const updatedRecipe = {
      ...recipe,
      updatedAt: new Date().toISOString()
    };
    setRecipes(recipes.map(r => r.id === recipe.id ? updatedRecipe : r));
  };

  const handleDeleteRecipe = (id: string) => {
    setRecipes(recipes.filter(r => r.id !== id));
  };

  const handleAddCookingRecord = (record: Omit<CookingRecord, 'id'>) => {
    const newRecord: CookingRecord = {
      ...record,
      id: Date.now().toString()
    };
    setCookingRecords([...cookingRecords, newRecord]);
  };

  const handleEditCookingRecord = (record: CookingRecord) => {
    setCookingRecords(cookingRecords.map(r => r.id === record.id ? record : r));
  };

  const handleDeleteCookingRecord = (id: string) => {
    setCookingRecords(cookingRecords.filter(r => r.id !== id));
  };

  const handleSaveMonthlyReflection = (reflection: MonthlyReflection) => {
    const existingIndex = monthlyReflections.findIndex(r => r.month === reflection.month);
    if (existingIndex >= 0) {
      setMonthlyReflections(monthlyReflections.map(r => r.month === reflection.month ? reflection : r));
    } else {
      setMonthlyReflections([...monthlyReflections, reflection]);
    }
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
  };

  const handleUpdateCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    handleEditExpense(expense);
  };

  const handleOpenExpenseDetail = (expense: Expense) => {
    console.log('Open expense detail:', expense);
  };

  const handleToggleRecurringExpenseStatus = (status: MonthlyExpenseStatus) => {
    console.log('Toggle recurring expense status:', status);
  };

  return {
    // 状態
    currentMonth,
    currentView,
    people,
    categories,
    expenses,
    income,
    recurringExpenses,
    monthlyExpenseStatuses,
    events,
    houseworkTasks,
    houseworkRecords,
    monthlyReflections,
    monthlyConfirmations,
    recipes,
    cookingRecords,

    // セッター
    setCurrentMonth,
    setCurrentView,
    setPeople,
    setCategories,
    setExpenses,
    setIncome,
    setRecurringExpenses,
    setMonthlyExpenseStatuses,
    setEvents,
    setHouseworkTasks,
    setHouseworkRecords,
    setMonthlyReflections,
    setMonthlyConfirmations,
    setRecipes,
    setCookingRecords,

    // ハンドラ
    handleAddExpense,
    handleEditExpense,
    handleDeleteExpense,
    handleAddIncome,
    handleAddPerson,
    handleEditPerson,
    handleDeletePerson,
    handleAddRecurringExpense,
    handleEditRecurringExpense,
    handleDeleteRecurringExpense,
    handleConfirmExpense,
    handleAddEvent,
    handleEditEvent,
    handleDeleteEvent,
    handleAddRecipe,
    handleEditRecipe,
    handleDeleteRecipe,
    handleAddCookingRecord,
    handleEditCookingRecord,
    handleDeleteCookingRecord,
    handleSaveMonthlyReflection,
    handleMonthlyConfirmation,
    handleUpdateCategories,
    handleOpenEditExpense,
    handleOpenExpenseDetail,
    handleToggleRecurringExpenseStatus,
  };
}