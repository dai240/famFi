'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpenseCategory } from '@/lib/expenses';
import { categoryName } from '@/lib/ledger';

export function CategorySelect({ id, label, value, onChange, categories, disabled, allowAll = false }: {
  id?: string; label: string; value: string; onChange: (value: string) => void;
  categories: ExpenseCategory[]; disabled?: boolean; allowAll?: boolean;
}) {
  return <Select value={value || (allowAll ? 'all' : '')} onValueChange={next => onChange(next === 'all' ? '' : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className={`category-select${allowAll ? ' category-filter' : ''}`}>
      <SelectValue placeholder="カテゴリを選択" />
    </SelectTrigger>
    <SelectContent className="category-options" position="popper" collisionPadding={12}>
      {allowAll && <SelectItem value="all" className="category-option">すべてのカテゴリ</SelectItem>}
      {categories.filter(c => allowAll || c.id === value || (!c.archived && !categories.find(parent => parent.id === c.parentId)?.archived)).map(category => <SelectItem key={category.id} value={category.id} textValue={categoryName(category, categories)} className="category-option">
        <span className="category-choice"><i aria-hidden="true" className="category-swatch" style={{ backgroundColor: category.color }} /><span>{categoryName(category, categories)}{category.archived ? '（使用停止）' : ''}</span></span>
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
