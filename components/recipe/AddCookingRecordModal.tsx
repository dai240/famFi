'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, ChefHat, Users, Calendar } from 'lucide-react';
import type { Recipe, Person, CookingRecord } from '@/app/page';

interface AddCookingRecordModalProps {
  isOpen: boolean;
  recipe: Recipe | null;
  people: Person[];
  onClose: () => void;
  onSave: (record: Omit<CookingRecord, 'id'>) => void;
}

export function AddCookingRecordModal({ isOpen, recipe, people, onClose, onSave }: AddCookingRecordModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cookedBy: '',
    servings: recipe?.servings || 4,
    rating: 5,
    notes: '',
    photos: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe || !formData.cookedBy) return;

    onSave({
      recipeId: recipe.id,
      date: formData.date,
      cookedBy: formData.cookedBy,
      servings: formData.servings,
      rating: formData.rating,
      notes: formData.notes || undefined,
      photos: formData.photos.length > 0 ? formData.photos : undefined
    });

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      cookedBy: '',
      servings: recipe?.servings || 4,
      rating: 5,
      notes: '',
      photos: []
    });
  };

  const renderStars = (rating: number, onRatingChange?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onRatingChange && onRatingChange(i + 1)}
        className={`w-6 h-6 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        } ${onRatingChange ? 'hover:text-yellow-400 cursor-pointer' : ''}`}
      >
        <Star className="w-full h-full" />
      </button>
    ));
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            作成記録を追加
          </DialogTitle>
        </DialogHeader>

        {/* Recipe Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            {recipe.imageUrl ? (
              <img 
                src={recipe.imageUrl} 
                alt={recipe.title}
                className="w-12 h-12 object-cover rounded-lg"
              />
            ) : (
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-orange-600" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{recipe.title}</h3>
              <p className="text-sm text-gray-600">{recipe.category}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">作成日</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cookedBy">作成者</Label>
              <Select value={formData.cookedBy} onValueChange={(value) => setFormData({ ...formData, cookedBy: value })} required>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="作成者を選択" />
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

          <div>
            <Label htmlFor="servings">実際の人数分</Label>
            <div className="flex items-center gap-2 mt-1">
              <Users className="w-4 h-4 text-gray-500" />
              <Input
                id="servings"
                type="number"
                min="1"
                value={formData.servings}
                onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) })}
                className="w-20"
              />
              <span className="text-sm text-gray-600">人分</span>
              <span className="text-xs text-gray-500 ml-2">
                (レシピ: {recipe.servings}人分)
              </span>
            </div>
          </div>

          <div>
            <Label>評価</Label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex">
                {renderStars(formData.rating, (rating) => setFormData({ ...formData, rating }))}
              </div>
              <span className="text-sm text-gray-600">({formData.rating}/5)</span>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">メモ・感想（任意）</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="作ってみた感想や改善点など"
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">記録内容</span>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• 作成回数がカウントされます</p>
              <p>• レシピの人気度に反映されます</p>
              <p>• 平均評価が更新されます</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700">
              記録する
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}