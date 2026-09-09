'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ReferenceSelect({ id, label, value, options, onChange, disabled, emptyLabel = '未設定' }: {
  id?: string; label: string; value: string | null; options: { id: string; name: string; archived?: boolean }[];
  onChange: (value: string | null) => void; disabled?: boolean; emptyLabel?: string;
}) {
  return <Select value={value || 'none'} onValueChange={next => onChange(next === 'none' ? null : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className="category-select"><SelectValue /></SelectTrigger>
    <SelectContent className="category-options" position="popper" collisionPadding={12}>
      <SelectItem className="category-option" value="none">{emptyLabel}</SelectItem>
      {options.map(option => <SelectItem className="category-option" key={option.id} value={option.id}>{option.name}{option.archived ? '（使用停止）' : ''}</SelectItem>)}
    </SelectContent>
  </Select>;
}
