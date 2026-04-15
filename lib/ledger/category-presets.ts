import type { Category } from './types';

export const uncategorizedCategoryId = 'cat-uncategorized';
export const uncategorizedSubCategoryId = 'sub-uncategorized';

export const categoryPresets: Category[] = [
  {
    id: 'cat-housing',
    name: '住居費',
    isActive: true,
    sortOrder: 10,
    subCategories: [
      { id: 'sub-housing-rent', name: '家賃', isActive: true, sortOrder: 10 },
      { id: 'sub-housing-management', name: '管理費', isActive: true, sortOrder: 20 },
      { id: 'sub-housing-repair', name: '修繕費', isActive: true, sortOrder: 30 },
      { id: 'sub-housing-move', name: '引越し', isActive: true, sortOrder: 40 },
    ],
  },
  {
    id: 'cat-utilities',
    name: '光熱費',
    isActive: true,
    sortOrder: 20,
    subCategories: [
      { id: 'sub-utilities-electricity', name: '電気', isActive: true, sortOrder: 10 },
      { id: 'sub-utilities-gas', name: 'ガス', isActive: true, sortOrder: 20 },
      { id: 'sub-utilities-water', name: '水道', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-communication',
    name: '通信費',
    isActive: true,
    sortOrder: 30,
    subCategories: [
      { id: 'sub-communication-mobile', name: '携帯', isActive: true, sortOrder: 10 },
      { id: 'sub-communication-internet', name: 'インターネット', isActive: true, sortOrder: 20 },
      { id: 'sub-communication-subscription', name: 'サブスク', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-food',
    name: '食費',
    isActive: true,
    sortOrder: 40,
    subCategories: [
      { id: 'sub-food-grocery', name: '食材', isActive: true, sortOrder: 10 },
      { id: 'sub-food-eatout', name: '外食', isActive: true, sortOrder: 20 },
      { id: 'sub-food-delivery', name: '弁当・惣菜', isActive: true, sortOrder: 30 },
      { id: 'sub-food-snack', name: 'お菓子・飲料', isActive: true, sortOrder: 40 },
    ],
  },
  {
    id: 'cat-daily',
    name: '日用品・雑費',
    isActive: true,
    sortOrder: 50,
    subCategories: [
      { id: 'sub-daily-consumables', name: '消耗品', isActive: true, sortOrder: 10 },
      { id: 'sub-daily-medical', name: '薬・衛生用品', isActive: true, sortOrder: 20 },
      { id: 'sub-daily-other', name: '雑費', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-childcare',
    name: '育児・教育',
    isActive: true,
    sortOrder: 60,
    subCategories: [
      { id: 'sub-childcare-nursery', name: '保育園', isActive: true, sortOrder: 10 },
      { id: 'sub-childcare-learning', name: '習い事', isActive: true, sortOrder: 20 },
      { id: 'sub-childcare-supplies', name: '教材・用品', isActive: true, sortOrder: 30 },
      { id: 'sub-childcare-medical', name: '医療費', isActive: true, sortOrder: 40 },
    ],
  },
  {
    id: 'cat-transport',
    name: '交通費',
    isActive: true,
    sortOrder: 70,
    subCategories: [
      { id: 'sub-transport-train', name: '電車・バス', isActive: true, sortOrder: 10 },
      { id: 'sub-transport-taxi', name: 'タクシー', isActive: true, sortOrder: 20 },
      { id: 'sub-transport-parking', name: '駐車場', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-insurance',
    name: '保険',
    isActive: true,
    sortOrder: 80,
    subCategories: [
      { id: 'sub-insurance-life', name: '生命保険', isActive: true, sortOrder: 10 },
      { id: 'sub-insurance-medical', name: '医療保険', isActive: true, sortOrder: 20 },
      { id: 'sub-insurance-other', name: 'その他保険', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-car',
    name: '車関連',
    isActive: true,
    sortOrder: 90,
    subCategories: [
      { id: 'sub-car-gasoline', name: 'ガソリン', isActive: true, sortOrder: 10 },
      { id: 'sub-car-maintenance', name: '整備・車検', isActive: true, sortOrder: 20 },
      { id: 'sub-car-tax', name: '税金', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-leisure',
    name: 'レジャー・イベント',
    isActive: true,
    sortOrder: 100,
    subCategories: [
      { id: 'sub-leisure-trip', name: '旅行', isActive: true, sortOrder: 10 },
      { id: 'sub-leisure-event', name: 'イベント', isActive: true, sortOrder: 20 },
      { id: 'sub-leisure-gift', name: 'プレゼント・お祝い', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-large-purchase',
    name: '家具・家電・大型購入',
    isActive: true,
    sortOrder: 110,
    subCategories: [
      { id: 'sub-large-furniture', name: '家具', isActive: true, sortOrder: 10 },
      { id: 'sub-large-appliance', name: '家電', isActive: true, sortOrder: 20 },
      { id: 'sub-large-other', name: '大型購入', isActive: true, sortOrder: 30 },
    ],
  },
  {
    id: 'cat-other',
    name: 'その他',
    isActive: true,
    sortOrder: 120,
    subCategories: [
      { id: 'sub-other-fee', name: '手数料', isActive: true, sortOrder: 10 },
      { id: 'sub-other-misc', name: 'その他', isActive: true, sortOrder: 20 },
    ],
  },
  {
    id: uncategorizedCategoryId,
    name: '未分類',
    isActive: true,
    sortOrder: 999,
    subCategories: [
      { id: uncategorizedSubCategoryId, name: '未分類', isActive: true, sortOrder: 10 },
    ],
  },
];

export function cloneCategoryPresets(): Category[] {
  return categoryPresets.map((category) => ({
    ...category,
    subCategories: category.subCategories.map((subCategory) => ({ ...subCategory })),
  }));
}
