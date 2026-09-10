'use client';

import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpenseCategory } from '@/lib/expenses';
import { categoryChoices } from '@/lib/ledger';

export function CategorySelect({ id, label, value, onChange, categories, disabled, allowAll = false, optional=false }: {
  id?: string; label: string; value: string; onChange: (value: string) => void;
  categories: ExpenseCategory[]; disabled?: boolean; allowAll?: boolean; optional?:boolean;
}) {
  const generatedId = useId();
  const detailId = `${id ?? generatedId}-detail`;
  const { parent, parents, children } = categoryChoices(categories, value, allowAll);
  return <div className={`category-picker${allowAll ? ' category-picker-filter' : ''}`}>
    <CategoryDropdown id={id} label={label} value={parent?.id ?? ''} onChange={onChange} categories={parents} disabled={disabled}
      emptyLabel={allowAll ? 'すべてのカテゴリ' : optional?'未定':undefined} unavailable={category => !allowAll && category.archived && category.id !== value} />
    {parent && children.length > 0 && <div className="category-detail-field">
      <label htmlFor={detailId}>詳細カテゴリ{!allowAll && <span className="muted-text"> 任意</span>}</label>
      <CategoryDropdown id={detailId} label={allowAll ? '詳細カテゴリで絞り込み' : '詳細カテゴリ'} value={value === parent.id ? '' : value}
        onChange={next => onChange(next || parent.id)} categories={children} disabled={disabled}
        emptyLabel={allowAll ? 'すべての詳細カテゴリ' : '指定なし'} emptyDisabled={!allowAll && parent.archived && value !== parent.id}
        parentArchived={parent.archived} />
    </div>}
  </div>;
}

function CategoryDropdown({ id, label, value, onChange, categories, disabled, emptyLabel, emptyDisabled, parentArchived, unavailable }: {
  id?: string; label: string; value: string; onChange: (value: string) => void; categories: ExpenseCategory[];
  disabled?: boolean; emptyLabel?: string; emptyDisabled?: boolean; parentArchived?: boolean;
  unavailable?: (category: ExpenseCategory) => boolean;
}) {
  return <Select value={value || (emptyLabel ? 'all' : '')} onValueChange={next => onChange(next === 'all' ? '' : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className="category-select"><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
    <SelectContent className="category-options" position="popper" collisionPadding={12}>
      {emptyLabel && <SelectItem value="all" disabled={emptyDisabled} className="category-option">{emptyLabel}</SelectItem>}
      {categories.map(category => <SelectItem key={category.id} value={category.id} textValue={category.name} disabled={unavailable?.(category)} className="category-option">
        <span className="category-choice"><i aria-hidden="true" className="category-swatch" style={{ backgroundColor: category.color }} /><span>{category.name}{(category.archived || parentArchived) ? '（使用停止）' : ''}</span></span>
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
