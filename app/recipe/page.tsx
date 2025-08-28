'use client';

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecipeManagement } from "@/components/recipe/RecipeManagement";
import { useDashboard } from "@/hooks/useDashboard";

export default function RecipePage() {
  const {
    people,
    recipes,
    cookingRecords,
    setRecipes,
    setCookingRecords,
  } = useDashboard();

  return (
    <DashboardLayout
      currentMonth={new Date()}
      currentView="recipes"
      onMonthChange={() => {}}
      onViewChange={() => {}}
    >
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">レシピ・料理管理</h1>
        <p className="text-gray-600">レシピの管理と料理記録を行います</p>
      </div>

      {/* メイン表示 */}
      <RecipeManagement
        recipes={recipes}
        people={people}
        cookingRecords={cookingRecords}
        onUpdateRecipes={setRecipes}
        onUpdateCookingRecords={setCookingRecords}
      />
    </DashboardLayout>
  );
}