'use client';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Option = { id: string; name: string; archived?: boolean };
export function ReferenceSelect({ id, label, value, options, groups, onChange, disabled, emptyLabel = '未設定', allowEmpty = true }: {
  id?: string; label: string; value: string | null; options: { id: string; name: string; archived?: boolean }[];
  onChange: (value: string | null) => void; disabled?: boolean; emptyLabel?: string; allowEmpty?: boolean;
  groups?: { id: string; name: string; options: Option[] }[];
}) {
  const item = (option: Option) => <SelectItem className="category-option" key={option.id} value={option.id}>{option.name}{option.archived ? '（使用停止）' : ''}</SelectItem>;
  return <Select value={value || 'none'} onValueChange={next => onChange(next === 'none' ? null : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className="category-select"><SelectValue /></SelectTrigger>
    <SelectContent className="category-options" position="popper" collisionPadding={12}>
      {(allowEmpty || !value) && <SelectItem className="category-option" value="none" disabled={!allowEmpty}>{emptyLabel}</SelectItem>}
      {groups ? groups.map(group => <SelectGroup key={group.id}><SelectLabel className="reference-group-label">{group.name}</SelectLabel>{group.options.map(item)}</SelectGroup>) : options.map(item)}
    </SelectContent>
  </Select>;
}
