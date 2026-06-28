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
  personId: string;
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
  servings?: number;
  rating?: number;
  notes?: string;
  photos?: string[];
}
