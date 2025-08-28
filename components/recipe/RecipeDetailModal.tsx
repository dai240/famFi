'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Clock, Users, Edit, Trash2, ChefHat, User, Star, Calendar, TrendingUp, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Recipe, Person, CookingRecord } from '@/app/page';

interface RecipeDetailModalProps {
  isOpen: boolean;
  recipe: Recipe | null;
  people: Person[];
  cookingRecords: CookingRecord[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onAddCookingRecord: () => void;
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

// 材料の種類を判定して色を返す関数
const getIngredientColor = (ingredientName: string): string => {
  const name = ingredientName.toLowerCase();
  
  // 主材料（肉・魚・卵・豆腐など）- 赤系
  if (name.includes('肉') || name.includes('鶏') || name.includes('豚') || name.includes('牛') || 
      name.includes('魚') || name.includes('卵') || name.includes('豆腐') || name.includes('納豆') ||
      name.includes('ハム') || name.includes('ベーコン') || name.includes('ソーセージ') ||
      name.includes('鮭') || name.includes('まぐろ') || name.includes('えび') || name.includes('いか')) {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  
  // 野菜・きのこ類 - 緑系
  if (name.includes('野菜') || name.includes('もやし') || name.includes('きゅうり') || 
      name.includes('キャベツ') || name.includes('レタス') || name.includes('ほうれん草') ||
      name.includes('にんじん') || name.includes('玉ねぎ') || name.includes('ねぎ') ||
      name.includes('トマト') || name.includes('ピーマン') || name.includes('なす') ||
      name.includes('きのこ') || name.includes('しいたけ') || name.includes('えのき') ||
      name.includes('大根') || name.includes('白菜') || name.includes('ブロッコリー')) {
    return 'bg-green-50 text-green-800 border-green-200';
  }
  
  // 調味料・香辛料 - 青系
  if (name.includes('しょうゆ') || name.includes('醤油') || name.includes('みそ') || 
      name.includes('味噌') || name.includes('塩') || name.includes('砂糖') || 
      name.includes('酢') || name.includes('油') || name.includes('だし') ||
      name.includes('コンソメ') || name.includes('ブイヨン') || name.includes('スープ') ||
      name.includes('こしょう') || name.includes('胡椒') || name.includes('にんにく') ||
      name.includes('しょうが') || name.includes('生姜') || name.includes('わさび') ||
      name.includes('からし') || name.includes('マヨネーズ') || name.includes('ケチャップ') ||
      name.includes('ソース') || name.includes('みりん') || name.includes('酒') ||
      name.includes('カレー') || name.includes('スパイス')) {
    return 'bg-blue-50 text-blue-800 border-blue-200';
  }
  
  // 穀物・麺類・パン - オレンジ系
  if (name.includes('米') || name.includes('ご飯') || name.includes('パン') || 
      name.includes('麺') || name.includes('うどん') || name.includes('そば') ||
      name.includes('パスタ') || name.includes('小麦粉') || name.includes('片栗粉')) {
    return 'bg-orange-50 text-orange-800 border-orange-200';
  }
  
  // 乳製品 - 紫系
  if (name.includes('牛乳') || name.includes('チーズ') || name.includes('バター') || 
      name.includes('ヨーグルト') || name.includes('生クリーム') || name.includes('クリーム')) {
    return 'bg-purple-50 text-purple-800 border-purple-200';
  }
  
  // その他 - グレー系
  return 'bg-gray-50 text-gray-800 border-gray-200';
};

// 作り方の文章内で材料をハイライトする関数
const highlightIngredients = (instruction: string, ingredients: any[]): JSX.Element => {
  let highlightedText = instruction;
  const ingredientMap = new Map<string, string>();
  
  // 材料名とその色のマッピングを作成
  ingredients.forEach(ingredient => {
    const color = getIngredientColor(ingredient.name);
    ingredientMap.set(ingredient.name, color);
  });
  
  // 材料名を長い順にソートして、部分一致を避ける
  const sortedIngredients = ingredients
    .map(ing => ing.name)
    .sort((a, b) => b.length - a.length);
  
  // JSXエレメントの配列を作成
  const parts: (string | JSX.Element)[] = [instruction];
  
  sortedIngredients.forEach((ingredientName, index) => {
    if (!ingredientName.trim()) return;
    
    const color = ingredientMap.get(ingredientName) || 'bg-gray-50 text-gray-800 border-gray-200';
    
    for (let i = 0; i < parts.length; i++) {
      if (typeof parts[i] === 'string') {
        const text = parts[i] as string;
        const regex = new RegExp(`(${ingredientName})`, 'g');
        
        if (regex.test(text)) {
          const splitParts = text.split(regex);
          const newParts: (string | JSX.Element)[] = [];
          
          splitParts.forEach((part, partIndex) => {
            if (part === ingredientName) {
              newParts.push(
                <span 
                  key={`${index}-${partIndex}`}
                  className={`px-1 py-0.5 rounded text-xs font-medium border ${color}`}
                >
                  {part}
                </span>
              );
            } else if (part) {
              newParts.push(part);
            }
          });
          
          parts.splice(i, 1, ...newParts);
          i += newParts.length - 1;
        }
      }
    }
  });
  
  return <>{parts}</>;
};

export function RecipeDetailModal({ 
  isOpen, 
  recipe, 
  people, 
  cookingRecords,
  onClose, 
  onEdit, 
  onDelete, 
  onToggleFavorite,
  onAddCookingRecord
}: RecipeDetailModalProps) {
  if (!recipe) return null;

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || '不明';
  };

  const handleDelete = () => {
    if (confirm('このレシピを削除しますか？')) {
      onDelete(recipe.id);
    }
  };

  // Get cooking records for this recipe
  const recipeCookingRecords = cookingRecords.filter(record => record.recipeId === recipe.id);
  const totalCooks = recipeCookingRecords.length;
  const averageRating = totalCooks > 0 
    ? recipeCookingRecords.reduce((sum, record) => sum + (record.rating || 0), 0) / totalCooks 
    : 0;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const totalCookingTime = recipe.steps.reduce((total, step) => total + (step.duration || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start gap-4">
            <DialogTitle className="text-xl md:text-2xl pr-4">{recipe.title}</DialogTitle>
            <div className="flex gap-1 md:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleFavorite(recipe.id)}
                className={`h-8 w-8 md:h-10 md:w-10 ${recipe.isFavorite ? 'text-red-600' : 'text-gray-600'}`}
              >
                <Heart className={`w-4 h-4 md:w-5 md:h-5 ${recipe.isFavorite ? 'fill-current' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 md:h-10 md:w-10">
                <Edit className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 h-8 w-8 md:h-10 md:w-10">
                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="recipe" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="recipe">レシピ</TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-2">
              作成記録
              {totalCooks > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalCooks}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipe" className="space-y-4 md:space-y-6">
            {/* Recipe Image */}
            {recipe.imageUrl && (
              <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Recipe Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="flex items-center gap-2 p-2 md:p-3 bg-gray-50 rounded-lg">
                <Clock className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600">調理時間</p>
                  <p className="text-sm md:text-base font-semibold">{recipe.cookingTime}分</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 md:p-3 bg-gray-50 rounded-lg">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600">人数</p>
                  <p className="text-sm md:text-base font-semibold">{recipe.servings}人分</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 md:p-3 bg-gray-50 rounded-lg">
                <ChefHat className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600">難易度</p>
                  <Badge className={`text-xs ${difficultyColors[recipe.difficulty]}`}>
                    {difficultyLabels[recipe.difficulty]}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 md:p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600">作成者</p>
                  <p className="text-sm md:text-base font-semibold">{getPersonName(recipe.createdBy)}</p>
                </div>
              </div>
            </div>

            {/* Cooking Statistics */}
            {totalCooks > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <span className="font-semibold text-orange-900">作成統計</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-orange-700">作成回数</p>
                    <p className="text-xl font-bold text-orange-900">{totalCooks}回</p>
                  </div>
                  <div>
                    <p className="text-sm text-orange-700">平均評価</p>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {renderStars(Math.round(averageRating))}
                      </div>
                      <span className="text-sm text-orange-800">({averageRating.toFixed(1)})</span>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-sm text-orange-700">最終作成</p>
                    <p className="text-sm font-semibold text-orange-900">
                      {recipeCookingRecords.length > 0 
                        ? format(new Date(recipeCookingRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date), 'M月d日')
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tags and Category */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs md:text-sm ${categoryColors[recipe.category] || 'bg-gray-100 text-gray-800'}`}>
                  {recipe.category}
                </Badge>
              </div>
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 md:gap-2">
                  {recipe.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            {recipe.description && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                <p className="text-blue-900 text-sm md:text-base">{recipe.description}</p>
              </div>
            )}

            {/* Ingredients */}
            <div>
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">材料</h3>
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <div className="space-y-2">
                  {recipe.ingredients.map((ingredient) => {
                    const colorClass = getIngredientColor(ingredient.name);
                    return (
                      <div key={ingredient.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <span className={`px-2 py-1 rounded text-xs md:text-sm font-medium border ${colorClass}`}>
                          {ingredient.name}
                        </span>
                        <span className="font-medium text-gray-700 text-sm md:text-base">
                          {ingredient.amount} {ingredient.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* 色分けの説明 */}
              <div className="mt-3 p-2 md:p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">材料の色分け:</p>
                <div className="flex flex-wrap gap-1 md:gap-2 text-xs">
                  <span className="px-2 py-1 rounded border bg-red-50 text-red-800 border-red-200">主材料</span>
                  <span className="px-2 py-1 rounded border bg-green-50 text-green-800 border-green-200">野菜・きのこ</span>
                  <span className="px-2 py-1 rounded border bg-blue-50 text-blue-800 border-blue-200">調味料</span>
                  <span className="px-2 py-1 rounded border bg-orange-50 text-orange-800 border-orange-200">穀物・麺</span>
                  <span className="px-2 py-1 rounded border bg-purple-50 text-purple-800 border-purple-200">乳製品</span>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div>
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">作り方</h3>
              <div className="space-y-3 md:space-y-4">
                {recipe.steps.map((step) => (
                  <div key={step.id} className="border border-gray-200 rounded-lg p-3 md:p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-xs md:text-sm">
                        {step.stepNumber}
                      </div>
                      {step.duration && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {step.duration}分
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <div className="md:col-span-2">
                        <p className="text-gray-900 leading-relaxed text-sm md:text-base">
                          {highlightIngredients(step.instruction, recipe.ingredients)}
                        </p>
                      </div>
                      {step.imageUrl && (
                        <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                          <img 
                            src={step.imageUrl} 
                            alt={`手順 ${step.stepNumber}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {recipe.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
                <h4 className="font-semibold text-yellow-900 mb-2 text-sm md:text-base">メモ・コツ</h4>
                <p className="text-yellow-800 text-sm md:text-base">{recipe.notes}</p>
              </div>
            )}

            {/* Recipe Meta */}
            <div className="text-xs md:text-sm text-gray-500 border-t pt-4">
              <p>作成日: {format(new Date(recipe.createdAt), 'yyyy年M月d日')}</p>
              {recipe.updatedAt !== recipe.createdAt && (
                <p>更新日: {format(new Date(recipe.updatedAt), 'yyyy年M月d日')}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">作成記録</h3>
              <Button onClick={onAddCookingRecord} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                記録を追加
              </Button>
            </div>

            {recipeCookingRecords.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">まだ作成記録がありません</p>
                <Button onClick={onAddCookingRecord}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初の記録を追加
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recipeCookingRecords
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record) => (
                    <div key={record.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <ChefHat className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{getPersonName(record.cookedBy)}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(record.date), 'yyyy年M月d日')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {record.rating && (
                            <div className="flex items-center gap-1 mb-1">
                              {renderStars(record.rating)}
                            </div>
                          )}
                          {record.servings && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Users className="w-3 h-3" />
                              {record.servings}人分
                            </div>
                          )}
                        </div>
                      </div>
                      {record.notes && (
                        <div className="bg-white rounded p-3 border">
                          <p className="text-sm text-gray-700">{record.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}