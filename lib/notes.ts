import { z } from 'zod';
import type { HouseholdNote } from '@prisma/client';
import { dateSchema, monthSchema, todayInJapan } from './expenses';

export const noteFields = z.object({
  name: z.string().trim().min(1, '件名を入力してください。').max(120),
  memo: z.string().trim().max(4000).default(''),
  kind: z.enum(['note', 'task']),
  date: z.union([dateSchema, monthSchema]).nullable().default(null),
}).strict();
export type NoteFields = z.infer<typeof noteFields>;
export type NoteRecord = NoteFields & { id: string; completed: boolean; version: number; createdAt: string; updatedAt: string };
export function serializeNote(row: HouseholdNote): NoteRecord {
  return { id: row.id, name: row.name, memo: row.memo, kind: row.kind as NoteFields['kind'],
    date: row.date?.toISOString().slice(0, row.datePrecision === 'month' ? 7 : 10) ?? null,
    completed: row.completed, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function noteIsOverdue(note: Pick<NoteRecord, 'kind'|'completed'|'date'>, today = todayInJapan()) {
  return note.kind === 'task' && !note.completed && Boolean(note.date && note.date < today.slice(0, note.date.length));
}
