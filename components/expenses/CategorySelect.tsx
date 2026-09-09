'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpenseCategory } from '@/lib/expenses';

export function CategorySelect({ id, label, value, onChange, categories, disabled, allowAll = false }: {
  id?: string; label: string; value: string; onChange: (value: string) => void;
  categories: ExpenseCategory[]; disabled?: boolean; allowAll?: boolean;
}) {
  return <Select value={value || 'all'} onValueChange={next => onChange(next === 'all' ? '' : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className={`category-select${allowAll ? ' category-filter' : ''}`}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="category-options" position="popper" collisionPadding={12}>
      {allowAll && <SelectItem value="all" className="category-option">すべてのカテゴリ</SelectItem>}
      {categories.map(category => <SelectItem key={category.id} value={category.id} textValue={category.name} className="category-option">
        <span className="category-choice"><i aria-hidden="true" className="category-swatch" style={{ backgroundColor: category.color }} /><span>{category.name}</span></span>
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
