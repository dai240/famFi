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
} from '@/types';

import {
  samplePeople,
  sampleCategories,
  sampleExpenses,
  sampleIncome,
  sampleRecurringExpenses,
  sampleMonthlyExpenseStatuses,
  sampleEvents,
  sampleHouseworkTasks,
  sampleHouseworkRecords,
  sampleRecipes,
  sampleCookingRecords
} from '@/data/sampleData';

export function useDashboard() {
  // 基本状態
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentView, setCurrentView] = useState('dashboard');

  // サンプルデータ
  const [people, setPeople] = useState<Person[]>(samplePeople);

  const [categories, setCategories] = useState<Category[]>(sampleCategories);

  const [expenses, setExpenses] = useState<Expense[]>(sampleExpenses);

  const [income, setIncome] = useState<Income[]>(sampleIncome);

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(sampleRecurringExpenses);

  const [monthlyExpenseStatuses, setMonthlyExpenseStatuses] = useState<MonthlyExpenseStatus[]>(sampleMonthlyExpenseStatuses);

  const [events, setEvents] = useState<Event[]>(sampleEvents);

  const [houseworkTasks, setHouseworkTasks] = useState<HouseworkTask[]>(sampleHouseworkTasks);

  const [houseworkRecords, setHouseworkRecords] = useState<HouseworkRecord[]>(sampleHouseworkRecords);

  const [monthlyReflections, setMonthlyReflections] = useState<MonthlyReflection[]>([]);
  const [monthlyConfirmations, setMonthlyConfirmations] = useState<MonthlyConfirmation[]>([]);

  const [recipes, setRecipes] = useState<Recipe[]>(sampleRecipes);

  const [cookingRecords, setCookingRecords] = useState<CookingRecord[]>(sampleCookingRecords);

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