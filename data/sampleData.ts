import type {
  Person,
  Category,
  Expense,
  Income,
  RecurringExpense,
  MonthlyExpenseStatus,
  Event,
  HouseworkTask,
  HouseworkRecord,
  Recipe,
  CookingRecord
} from '@/types';

export const samplePeople: Person[] = [
  { id: '1', name: '田中太郎', group: '家族', birthday: '1985-05-15' },
  { id: '2', name: '田中花子', group: '家族', birthday: '1987-08-22' },
  { id: '3', name: '田中一郎', group: '家族', birthday: '2015-03-10' },
  { id: '4', name: '田中二郎', group: '家族', birthday: '2018-11-05' }
];

export const sampleCategories: Category[] = [
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
];

export const sampleExpenses: Expense[] = [
  {
    id: '1',
    date: '2025-08-10',
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
    date: '2025-08-15',
    amount: 25000,
    category: '食費',
    subcategory: '食材',
    description: '週末の買い物',
    paymentMethod: '現金',
    paidBy: '2',
    beneficiaries: ['1', '2', '3', '4']
  },
  {
    id: '3',
    date: '2025-08-20',
    amount: 15000,
    category: '食費',
    subcategory: '外食',
    description: '家族でランチ',
    paymentMethod: 'クレジットカード',
    paidBy: '1',
    beneficiaries: ['1', '2', '3', '4']
  },
  {
    id: '4',
    date: '2025-08-25',
    amount: 5000,
    category: '育児・教育',
    subcategory: '習い事',
    description: 'ピアノレッスン',
    paymentMethod: '現金',
    paidBy: '2',
    beneficiaries: ['3']
  },
  {
    id: '5',
    date: '2025-08-28',
    amount: 8000,
    category: '保険・医療',
    subcategory: '病院',
    description: '定期検診',
    paymentMethod: '現金',
    paidBy: '1',
    beneficiaries: ['1']
  }
];

export const sampleIncome: Income[] = [
  {
    id: '1',
    date: '2025-08-25',
    amount: 300000,
    description: '給与',
    personId: '1'
  },
  {
    id: '2',
    date: '2025-08-25',
    amount: 200000,
    description: 'パート代',
    personId: '2'
  }
];

export const sampleRecurringExpenses: RecurringExpense[] = [
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
];

export const sampleMonthlyExpenseStatuses: MonthlyExpenseStatus[] = [
  {
    id: '1',
    recurringExpenseId: '1',
    month: '2024-07',
    status: 'confirmed',
    amount: 80000,
    confirmedDate: '2024-07-01'
  }
];

export const sampleEvents: Event[] = [
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
];

export const sampleHouseworkTasks: HouseworkTask[] = [
  {
    id: '1',
    name: '掃除機かけ',
    category: '掃除',
    frequency: 'weekly',
    assignedTo: '1',
    description: 'リビングと寝室の掃除機かけ',
    isActive: true
  }
];

export const sampleHouseworkRecords: HouseworkRecord[] = [
  {
    id: '1',
    taskId: '1',
    date: '2024-07-15',
    completedBy: '1',
    rating: 5
  }
];

export const sampleRecipes: Recipe[] = [
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
];

export const sampleCookingRecords: CookingRecord[] = [
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
];
