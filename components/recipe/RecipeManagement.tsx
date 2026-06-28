'use client';

import { useState } from 'react';
import { ChefHat, Plus, Search, Heart, Clock, Users, Star, Edit, Eye, Filter, BookOpen, Tag, Refrigerator, X, Calendar, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddRecipeModal } from '@/components/recipe/AddRecipeModal';
import { RecipeDetailModal } from '@/components/recipe/RecipeDetailModal';
import { EditRecipeModal } from '@/components/recipe/EditRecipeModal';
import { AddCookingRecordModal } from '@/components/recipe/AddCookingRecordModal';
import { format, isSameMonth } from 'date-fns';
import type { Recipe, Person, CookingRecord } from '@/types';

interface RecipeManagementProps {
  recipes: Recipe[];
  people: Person[];
  cookingRecords: CookingRecord[];
  onUpdateRecipes: (recipes: Recipe[]) => void;
  onUpdateCookingRecords: (records: CookingRecord[]) => void;
}

const difficultyLabels = {
  easy: '簡単',
  medium: '普通',
  hard: '難しい'
};

const difficultyColors = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800'
};

const categoryColors: Record<string, string> = {
  '主菜': 'bg-red-100 text-red-800',
  '副菜': 'bg-green-100 text-green-800',
  '汁物': 'bg-blue-100 text-blue-800',
  'ご飯もの': 'bg-orange-100 text-orange-800',
  'デザート': 'bg-pink-100 text-pink-800',
  'その他': 'bg-gray-100 text-gray-800',
};

const recipeCategories = ['主菜', '副菜', '汁物', 'ご飯もの', 'デザート', 'その他'];

// よく使われる材料のリスト
const commonIngredients = [
  '玉ねぎ', 'にんじん', 'じゃがいも', 'キャベツ', 'もやし', 'きゅうり', 'トマト', 'ピーマン', 'なす',
  '鶏肉', '豚肉', '牛肉', '卵', '豆腐', '納豆', 'ツナ缶', 'ハム', 'ベーコン',
  '米', 'パン', 'うどん', 'そば', 'パスタ', '小麦粉',
  '牛乳', 'チーズ', 'バター', 'ヨーグルト',
  'しょうゆ', 'みそ', '塩', '砂糖', '酢', '油', 'みりん', '酒', 'だし'
];

export function RecipeManagement({ recipes, people, cookingRecords, onUpdateRecipes, onUpdateCookingRecords }: RecipeManagementProps) {
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddCookingRecordOpen, setIsAddCookingRecordOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  // Get cooking statistics for each recipe
  const getRecipeStats = (recipeId: string) => {
    const recipeRecords = cookingRecords.filter(record => record.recipeId === recipeId);
    const totalCooks = recipeRecords.length;
    const averageRating = totalCooks > 0 
      ? recipeRecords.reduce((sum, record) => sum + (record.rating || 0), 0) / totalCooks 
      : 0;
    const lastCooked = totalCooks > 0 
      ? recipeRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : null;
    
    return { totalCooks, averageRating, lastCooked };
  };

  // Get all unique tags from recipes
  const allTags = Array.from(new Set(recipes.flatMap(recipe => recipe.tags))).sort();

  // Get all unique ingredients from recipes
  const allIngredients = Array.from(new Set(recipes.flatMap(recipe => 
    recipe.ingredients.map(ing => ing.name)
  ))).sort();

  // Filter ingredients based on search query
  const filteredCommonIngredients = commonIngredients.filter(ingredient =>
    ingredient.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
  );

  const filteredAllIngredients = allIngredients.filter(ingredient =>
    ingredient.toLowerCase().includes(ingredientSearchQuery.toLowerCase()) &&
    !commonIngredients.includes(ingredient)
  );

  // Filter recipes
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || recipe.category === categoryFilter;
    const matchesDifficulty = difficultyFilter === 'all' || recipe.difficulty === difficultyFilter;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => recipe.tags.includes(tag));
    
    // 材料での絞り込み
    const matchesIngredients = selectedIngredients.length === 0 || 
      selectedIngredients.every(ingredient => 
        recipe.ingredients.some(recipeIngredient => 
          recipeIngredient.name.toLowerCase().includes(ingredient.toLowerCase())
        )
      );
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesTags && matchesIngredients;
  });

  // 材料マッチ度でソート（材料検索時）
  const sortedFilteredRecipes = selectedIngredients.length > 0 
    ? [...filteredRecipes].sort((a, b) => {
        const aMatches = selectedIngredients.filter(ingredient => 
          a.ingredients.some(recipeIngredient => 
            recipeIngredient.name.toLowerCase().includes(ingredient.toLowerCase())
          )
        ).length;
        const bMatches = selectedIngredients.filter(ingredient => 
          b.ingredients.some(recipeIngredient => 
            recipeIngredient.name.toLowerCase().includes(ingredient.toLowerCase())
          )
        ).length;
        return bMatches - aMatches;
      })
    : filteredRecipes;

  const favoriteRecipes = sortedFilteredRecipes.filter(recipe => recipe.isFavorite);
  const recentRecipes = [...sortedFilteredRecipes].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 6);

  // Popular recipes (most cooked)
  const popularRecipes = [...sortedFilteredRecipes].sort((a, b) => {
    const aStats = getRecipeStats(a.id);
    const bStats = getRecipeStats(b.id);
    return bStats.totalCooks - aStats.totalCooks;
  }).slice(0, 6);

  const handleAddRecipe = (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRecipe: Recipe = {
      ...recipe,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onUpdateRecipes([...recipes, newRecipe]);
    setIsAddRecipeOpen(false);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    const updatedRecipe = {
      ...recipe,
      updatedAt: new Date().toISOString()
    };
    onUpdateRecipes(recipes.map(r => r.id === recipe.id ? updatedRecipe : r));
    setIsEditOpen(false);
    setSelectedRecipe(null);
  };

  const handleToggleFavorite = (recipeId: string) => {
    onUpdateRecipes(recipes.map(recipe => 
      recipe.id === recipeId 
        ? { ...recipe, isFavorite: !recipe.isFavorite, updatedAt: new Date().toISOString() }
        : recipe
    ));
  };

  const handleDeleteRecipe = (recipeId: string) => {
    if (confirm('このレシピを削除しますか？')) {
      onUpdateRecipes(recipes.filter(recipe => recipe.id !== recipeId));
      // Also delete related cooking records
      onUpdateCookingRecords(cookingRecords.filter(record => record.recipeId !== recipeId));
      setIsDetailOpen(false);
      setSelectedRecipe(null);
    }
  };

  const handleAddCookingRecord = (record: Omit<CookingRecord, 'id'>) => {
    const newRecord: CookingRecord = {
      ...record,
      id: Date.now().toString()
    };
    onUpdateCookingRecords([...cookingRecords, newRecord]);
    setIsAddCookingRecordOpen(false);
  };

  const openRecipeDetail = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsDetailOpen(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsEditOpen(true);
  };

  const openAddCookingRecord = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsAddCookingRecordOpen(true);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const toggleIngredient = (ingredient: string) => {
    if (selectedIngredients.includes(ingredient)) {
      setSelectedIngredients(selectedIngredients.filter(i => i !== ingredient));
    } else {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    }
  };

  const removeIngredient = (ingredient: string) => {
    setSelectedIngredients(selectedIngredients.filter(i => i !== ingredient));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDifficultyFilter('all');
    setSelectedTags([]);
    setSelectedIngredients([]);
    setIngredientSearchQuery('');
  };

  const getIngredientMatchCount = (recipe: Recipe) => {
    return selectedIngredients.filter(ingredient => 
      recipe.ingredients.some(recipeIngredient => 
        recipeIngredient.name.toLowerCase().includes(ingredient.toLowerCase())
      )
    ).length;
  };

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => {
    const matchCount = selectedIngredients.length > 0 ? getIngredientMatchCount(recipe) : 0;
    const stats = getRecipeStats(recipe.id);
    
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        <div className="relative" onClick={() => openRecipeDetail(recipe)}>
          <div className="aspect-video bg-gray-200 overflow-hidden">
            {recipe.imageUrl ? (
              <img 
                src={recipe.imageUrl} 
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
                <ChefHat className="w-8 h-8 md:w-12 md:h-12 text-orange-400" />
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(recipe.id);
            }}
            className={`absolute top-2 right-2 p-1.5 md:p-2 rounded-full transition-colors ${
              recipe.isFavorite 
                ? 'bg-red-500 text-white' 
                : 'bg-white/80 text-gray-600 hover:bg-white'
            }`}
          >
            <Heart className={`w-3 h-3 md:w-4 md:h-4 ${recipe.isFavorite ? 'fill-current' : ''}`} />
          </button>
          
          {/* 材料マッチ表示 */}
          {selectedIngredients.length > 0 && matchCount > 0 && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              {matchCount}/{selectedIngredients.length}
            </div>
          )}

          {/* 作成回数表示 */}
          {stats.totalCooks > 0 && (
            <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {stats.totalCooks}回
            </div>
          )}
        </div>
        
        <div className="p-3 md:p-4">
          <div className="flex items-center gap-1 md:gap-2 mb-2 flex-wrap">
            <Badge className={`text-xs ${categoryColors[recipe.category] || 'bg-gray-100 text-gray-800'}`}>
              {recipe.category}
            </Badge>
            <Badge className={`text-xs ${difficultyColors[recipe.difficulty]}`}>
              {difficultyLabels[recipe.difficulty]}
            </Badge>
            {stats.averageRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-xs text-gray-600">{stats.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          <h3 className="font-semibold text-gray-900 mb-2 text-sm md:text-base line-clamp-2">{recipe.title}</h3>
          
          {recipe.description && (
            <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">{recipe.description}</p>
          )}
          
          <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm">{recipe.cookingTime}分</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm">{recipe.servings}人</span>
              </div>
            </div>
          </div>

          {/* 作成記録情報 */}
          {stats.totalCooks > 0 && (
            <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
              <div className="flex justify-between items-center">
                <span>作成回数: {stats.totalCooks}回</span>
                {stats.lastCooked && (
                  <span>最終: {format(new Date(stats.lastCooked), 'M/d')}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditRecipe(recipe);
              }}
              className="h-6 w-6 md:h-8 md:w-8 p-0"
            >
              <Edit className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openAddCookingRecord(recipe);
              }}
              className="flex-1 text-xs h-6 md:h-8"
            >
              作った！
            </Button>
          </div>
          
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {recipe.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{recipe.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <ChefHat className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
              料理レシピ
            </CardTitle>
            <Button onClick={() => setIsAddRecipeOpen(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              レシピを追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cooking Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-orange-600 font-medium">レシピ数</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-orange-900">{recipes.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600 font-medium">今月作成</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-green-900">
                {cookingRecords.filter(record => 
                  isSameMonth(new Date(record.date), new Date())
                ).length}回
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-600 font-medium">お気に入り</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-red-900">{favoriteRecipes.length}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium">人気レシピ</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-purple-900">
                {popularRecipes.length > 0 ? getRecipeStats(popularRecipes[0].id).totalCooks : 0}回
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="レシピを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="カテゴリ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全カテゴリ</SelectItem>
                  {recipeCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="難易度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全難易度</SelectItem>
                  <SelectItem value="easy">簡単</SelectItem>
                  <SelectItem value="medium">普通</SelectItem>
                  <SelectItem value="hard">難しい</SelectItem>
                </SelectContent>
              </Select>

              {(searchQuery || categoryFilter !== 'all' || difficultyFilter !== 'all' || selectedTags.length > 0 || selectedIngredients.length > 0) && (
                <Button variant="outline" size="sm" onClick={clearAllFilters} className="w-full sm:w-auto">
                  フィルターをクリア
                </Button>
              )}
            </div>

            {/* 材料検索セクション */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Refrigerator className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">冷蔵庫の材料から探す</span>
              </div>
              
              {/* 選択中の材料 */}
              {selectedIngredients.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">選択中の材料:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ingredient) => (
                      <Badge key={ingredient} variant="secondary" className="text-xs flex items-center gap-1">
                        {ingredient}
                        <button
                          onClick={() => removeIngredient(ingredient)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 材料検索 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="材料を検索..."
                  value={ingredientSearchQuery}
                  onChange={(e) => setIngredientSearchQuery(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>

              {/* よく使う材料 */}
              {ingredientSearchQuery === '' && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">よく使う材料:</div>
                  <div className="flex flex-wrap gap-1">
                    {commonIngredients.slice(0, 15).map((ingredient) => (
                      <Button
                        key={ingredient}
                        variant={selectedIngredients.includes(ingredient) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleIngredient(ingredient)}
                        className="text-xs h-7"
                      >
                        {ingredient}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 検索結果の材料 */}
              {ingredientSearchQuery !== '' && (
                <div className="space-y-2">
                  {filteredCommonIngredients.length > 0 && (
                    <>
                      <div className="text-xs text-gray-600">よく使う材料:</div>
                      <div className="flex flex-wrap gap-1">
                        {filteredCommonIngredients.map((ingredient) => (
                          <Button
                            key={ingredient}
                            variant={selectedIngredients.includes(ingredient) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleIngredient(ingredient)}
                            className="text-xs h-7"
                          >
                            {ingredient}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  
                  {filteredAllIngredients.length > 0 && (
                    <>
                      <div className="text-xs text-gray-600">その他の材料:</div>
                      <div className="flex flex-wrap gap-1">
                        {filteredAllIngredients.map((ingredient) => (
                          <Button
                            key={ingredient}
                            variant={selectedIngredients.includes(ingredient) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleIngredient(ingredient)}
                            className="text-xs h-7"
                          >
                            {ingredient}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">タグで絞り込み</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {allTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className="text-xs h-7"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>選択中:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all" className="text-xs md:text-sm">
                全て ({sortedFilteredRecipes.length})
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs md:text-sm">
                お気に入り ({favoriteRecipes.length})
              </TabsTrigger>
              <TabsTrigger value="popular" className="text-xs md:text-sm">
                人気
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs md:text-sm">
                最近追加
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {sortedFilteredRecipes.length === 0 ? (
                <div className="text-center py-12">
                  <ChefHat className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4 text-sm md:text-base">
                    {recipes.length === 0 
                      ? 'まだレシピが登録されていません' 
                      : '条件に一致するレシピが見つかりません'
                    }
                  </p>
                  {recipes.length === 0 ? (
                    <Button onClick={() => setIsAddRecipeOpen(true)} className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      最初のレシピを追加
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={clearAllFilters} className="w-full sm:w-auto">
                      フィルターをクリア
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {selectedIngredients.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Refrigerator className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          材料マッチ度順で表示中
                        </span>
                      </div>
                      <p className="text-xs text-green-700">
                        選択した材料を多く使用するレシピから順番に表示しています
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {sortedFilteredRecipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="space-y-4">
              {favoriteRecipes.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm md:text-base">お気に入りのレシピがありません</p>
                  <p className="text-xs md:text-sm text-gray-400">レシピのハートマークをクリックしてお気に入りに追加しましょう</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {favoriteRecipes.map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="popular" className="space-y-4">
              {popularRecipes.length === 0 || popularRecipes.every(recipe => getRecipeStats(recipe.id).totalCooks === 0) ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm md:text-base">まだ作成記録がありません</p>
                  <p className="text-xs md:text-sm text-gray-400">レシピを作ったら「作った！」ボタンで記録しましょう</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {popularRecipes.filter(recipe => getRecipeStats(recipe.id).totalCooks > 0).map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="space-y-4">
              {recentRecipes.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm md:text-base">最近追加されたレシピがありません</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {recentRecipes.map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddRecipeModal
        isOpen={isAddRecipeOpen}
        onClose={() => setIsAddRecipeOpen(false)}
        onSave={handleAddRecipe}
        people={people}
      />

      <RecipeDetailModal
        isOpen={isDetailOpen}
        recipe={selectedRecipe}
        people={people}
        cookingRecords={cookingRecords}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRecipe(null);
        }}
        onEdit={() => {
          setIsDetailOpen(false);
          setIsEditOpen(true);
        }}
        onDelete={handleDeleteRecipe}
        onToggleFavorite={handleToggleFavorite}
        onAddCookingRecord={() => {
          setIsDetailOpen(false);
          setIsAddCookingRecordOpen(true);
        }}
      />

      <EditRecipeModal
        isOpen={isEditOpen}
        recipe={selectedRecipe}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedRecipe(null);
        }}
        onSave={handleEditRecipe}
        people={people}
      />

      <AddCookingRecordModal
        isOpen={isAddCookingRecordOpen}
        recipe={selectedRecipe}
        people={people}
        onClose={() => {
          setIsAddCookingRecordOpen(false);
          setSelectedRecipe(null);
        }}
        onSave={handleAddCookingRecord}
      />
    </div>
  );
}