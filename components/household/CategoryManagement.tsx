'use client';

import { Settings, Plus, Edit, Trash2, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import type { Category } from '@/types';

interface CategoryManagementProps {
  categories: Category[];
  onUpdateCategories: (categories: Category[]) => void;
}

const colorOptions = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#6B7280', '#EC4899', '#14B8A6', '#F97316', '#84CC16'
];

export function CategoryManagement({ categories, onUpdateCategories }: CategoryManagementProps) {
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    subcategories: ['']
  });

  const handleAddCategory = () => {
    if (!formData.name.trim()) return;

    const newCategory: Category = {
      id: Date.now().toString(),
      name: formData.name,
      color: formData.color,
      subcategories: formData.subcategories.filter(sub => sub.trim() !== '')
    };

    onUpdateCategories([...categories, newCategory]);
    setFormData({ name: '', color: '#3B82F6', subcategories: [''] });
    setIsAddCategoryOpen(false);
  };

  const handleEditCategory = () => {
    if (!editingCategory || !formData.name.trim()) return;

    const updatedCategories = categories.map(cat => 
      cat.id === editingCategory.id 
        ? {
            ...cat,
            name: formData.name,
            color: formData.color,
            subcategories: formData.subcategories.filter(sub => sub.trim() !== '')
          }
        : cat
    );

    onUpdateCategories(updatedCategories);
    setIsEditCategoryOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (confirm('このカテゴリを削除しますか？')) {
      onUpdateCategories(categories.filter(cat => cat.id !== categoryId));
    }
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      color: category.color,
      subcategories: [...category.subcategories, '']
    });
    setIsEditCategoryOpen(true);
  };

  const addSubcategory = () => {
    setFormData({
      ...formData,
      subcategories: [...formData.subcategories, '']
    });
  };

  const updateSubcategory = (index: number, value: string) => {
    const newSubcategories = [...formData.subcategories];
    newSubcategories[index] = value;
    setFormData({
      ...formData,
      subcategories: newSubcategories
    });
  };

  const removeSubcategory = (index: number) => {
    setFormData({
      ...formData,
      subcategories: formData.subcategories.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5 text-gray-600" />
              カテゴリ管理
            </CardTitle>
            <Button onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              カテゴリを追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditCategory(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.subcategories.map((subcategory, index) => (
                    <Badge key={index} variant="outline">
                      {subcategory}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Category Modal */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>カテゴリを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">カテゴリ名</Label>
              <Input
                id="categoryName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="カテゴリ名を入力"
              />
            </div>

            <div>
              <Label>カラー</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>サブカテゴリ</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubcategory}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.subcategories.map((subcategory, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={subcategory}
                      onChange={(e) => updateSubcategory(index, e.target.value)}
                      placeholder="サブカテゴリ名"
                    />
                    {formData.subcategories.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubcategory(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCategoryOpen(false)}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button onClick={handleAddCategory} className="flex-1">
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>カテゴリを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editCategoryName">カテゴリ名</Label>
              <Input
                id="editCategoryName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="カテゴリ名を入力"
              />
            </div>

            <div>
              <Label>カラー</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>サブカテゴリ</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubcategory}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.subcategories.map((subcategory, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={subcategory}
                      onChange={(e) => updateSubcategory(index, e.target.value)}
                      placeholder="サブカテゴリ名"
                    />
                    {formData.subcategories.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubcategory(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditCategoryOpen(false)}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button onClick={handleEditCategory} className="flex-1">
                更新
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}