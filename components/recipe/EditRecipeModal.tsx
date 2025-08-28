'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import type { Recipe, Ingredient, RecipeStep, Person } from '@/app/page';

interface EditRecipeModalProps {
  isOpen: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  people: Person[];
}

const recipeCategories = ['主菜', '副菜', '汁物', 'ご飯もの', 'デザート', 'その他'];
const commonTags = ['簡単', '節約', '時短', '作り置き', '子供向け', '野菜たっぷり', 'ヘルシー', '和食', '洋食', '中華'];

export function EditRecipeModal({ isOpen, recipe, onClose, onSave, people }: EditRecipeModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    servings: 4,
    cookingTime: 30,
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    category: '',
    tags: [] as string[],
    notes: '',
    createdBy: '',
    isFavorite: false
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (recipe) {
      setFormData({
        title: recipe.title,
        description: recipe.description || '',
        imageUrl: recipe.imageUrl || '',
        servings: recipe.servings,
        cookingTime: recipe.cookingTime,
        difficulty: recipe.difficulty,
        category: recipe.category,
        tags: recipe.tags,
        notes: recipe.notes || '',
        createdBy: recipe.createdBy,
        isFavorite: recipe.isFavorite
      });
      setIngredients(recipe.ingredients);
      setSteps(recipe.steps);
    }
  }, [recipe]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe || !formData.title || !formData.category || !formData.createdBy) {
      return;
    }

    const validIngredients = ingredients.filter(ing => ing.name.trim() !== '');
    const validSteps = steps.filter(step => step.instruction.trim() !== '');

    onSave({
      ...recipe,
      title: formData.title,
      description: formData.description || undefined,
      imageUrl: formData.imageUrl || undefined,
      servings: formData.servings,
      cookingTime: formData.cookingTime,
      difficulty: formData.difficulty,
      category: formData.category,
      tags: formData.tags,
      ingredients: validIngredients,
      steps: validSteps,
      notes: formData.notes || undefined,
      createdBy: formData.createdBy,
      isFavorite: formData.isFavorite
    });
  };

  const addIngredient = () => {
    const newId = Date.now().toString();
    setIngredients([...ingredients, { id: newId, name: '', amount: '', unit: '' }]);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const addStep = () => {
    const newId = Date.now().toString();
    const newStepNumber = steps.length + 1;
    setSteps([...steps, { id: newId, stepNumber: newStepNumber, instruction: '', imageUrl: '', duration: undefined }]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      const newSteps = steps.filter(step => step.id !== id);
      // Renumber steps
      const renumberedSteps = newSteps.map((step, index) => ({
        ...step,
        stepNumber: index + 1
      }));
      setSteps(renumberedSteps);
    }
  };

  const updateStep = (id: string, field: keyof RecipeStep, value: string | number) => {
    setSteps(steps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>レシピを編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">レシピ名</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例: 無限もやし"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">説明（任意）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="レシピの説明や特徴を入力"
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="imageUrl">画像URL（任意）</Label>
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="servings">人数</Label>
                <Input
                  id="servings"
                  type="number"
                  min="1"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cookingTime">調理時間（分）</Label>
                <Input
                  id="cookingTime"
                  type="number"
                  min="1"
                  value={formData.cookingTime}
                  onChange={(e) => setFormData({ ...formData, cookingTime: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="difficulty">難易度</Label>
                <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value as any })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">簡単</SelectItem>
                    <SelectItem value="medium">普通</SelectItem>
                    <SelectItem value="hard">難しい</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">カテゴリ</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipeCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="createdBy">作成者</Label>
              <Select value={formData.createdBy} onValueChange={(value) => setFormData({ ...formData, createdBy: value })} required>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="作成者を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.group === '家族').map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>タグ</Label>
            <div className="mt-2 space-y-3">
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    onClick={() => formData.tags.includes(tag) ? removeTag(tag) : addTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="カスタムタグを追加"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(newTag))}
                />
                <Button type="button" onClick={() => addTag(newTag)} disabled={!newTag}>
                  追加
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>材料</Label>
              <Button type="button" onClick={addIngredient} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                材料を追加
              </Button>
            </div>
            <div className="space-y-3">
              {ingredients.map((ingredient) => (
                <div key={ingredient.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="材料名"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(ingredient.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="分量"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(ingredient.id, 'amount', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="単位"
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(ingredient.id, 'unit', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIngredient(ingredient.id)}
                      disabled={ingredients.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>作り方</Label>
              <Button type="button" onClick={addStep} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                手順を追加
              </Button>
            </div>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-sm text-gray-700">手順 {step.stepNumber}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(step.id)}
                      disabled={steps.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="手順の説明を入力"
                      value={step.instruction}
                      onChange={(e) => updateStep(step.id, 'instruction', e.target.value)}
                      rows={3}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="画像URL（任意）"
                        value={step.imageUrl}
                        onChange={(e) => updateStep(step.id, 'imageUrl', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="所要時間（分）"
                        value={step.duration || ''}
                        onChange={(e) => updateStep(step.id, 'duration', e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">メモ・コツ（任意）</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="調理のコツやアレンジ方法など"
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" className="flex-1">
              更新
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}