import test from 'node:test';
import assert from 'node:assert/strict';
import { noteFields, noteIsOverdue } from '../lib/notes';
import { calendarDays, calendarActualTotal, CalendarEntry } from '../lib/expense-calendar';
test('notes accept day, month or no date without inventing an expense',()=>{
  for(const date of ['2026-09','2028-02-29',null])assert.equal(noteFields.parse({name:'Shared',kind:'note',date}).date,date);
  for(const date of ['2026-02-29','2026-13','1999-12-31'])assert.equal(noteFields.safeParse({name:'Shared',kind:'task',date}).success,false);
  assert.equal(noteFields.safeParse({name:' ',kind:'note'}).success,false);
  assert.equal(noteFields.safeParse({name:'x',kind:'note',userId:'injected'}).success,false);
  assert.equal(noteFields.safeParse({name:'x',kind:'note',memo:'x'.repeat(4001)}).success,false);
});
test('only unfinished dated tasks become overdue; month-only waits until following month',()=>{
  assert.equal(noteIsOverdue({kind:'task',completed:false,date:'2026-09'},'2026-09-30'),false);
  assert.equal(noteIsOverdue({kind:'task',completed:false,date:'2026-09'},'2026-10-01'),true);
  assert.equal(noteIsOverdue({kind:'task',completed:false,date:'2026-09-10'},'2026-09-10'),false);
  assert.equal(noteIsOverdue({kind:'task',completed:false,date:'2026-09-10'},'2026-09-11'),true);
  for(const kind of ['note','task'] as const)assert.equal(noteIsOverdue({kind,completed:true,date:'2020-01'},'2026-09-10'),false);
  assert.equal(noteIsOverdue({kind:'note',completed:false,date:'2020-01'},'2026-09-10'),false);
});
test('calendar covers leap years and six-week months; totals exclude plans and notes',()=>{
  assert.equal(calendarDays('2028-02').filter(Boolean).length,29);
  assert.equal(calendarDays('2026-08').length,42);
  assert.equal(calendarDays('2026-02')[0],'2026-02-01');
  assert.throws(()=>calendarDays('2026-13'));
  const entries=['expense','summary','plan','recurring','note','task'].map(kind=>({id:kind,kind,date:'2026-09',name:kind,amount:100,categoryId:null} as CalendarEntry));
  assert.equal(calendarActualTotal(entries),200);
});
