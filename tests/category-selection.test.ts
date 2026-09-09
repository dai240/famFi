import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryChoices, Category } from '../lib/ledger';

const row = (id: string, parentId: string | null = null, archived = false): Category =>
  ({ id, name: id, parentId, archived, color: '#16806A', sortOrder: 0, version: 1 });
const categories = [row('food'), row('grocery', 'food'), row('dining', 'food'), row('old', 'food', true),
  row('daily'), row('supplies', 'daily'), row('other'), row('retired', null, true), row('retired-child', 'retired')];

test('parent and detail options are separate and keep master ordering', () => {
  const choices = categoryChoices(categories, 'dining');
  assert.equal(choices.parent?.id, 'food');
  assert.deepEqual(choices.parents.map(c => c.id), ['food', 'daily', 'other']);
  assert.deepEqual(choices.children.map(c => c.id), ['grocery', 'dining']);
  assert.equal(categoryChoices(categories, 'food').parent?.id, 'food');
});

test('changing parent or clearing filters never retains an unrelated detail', () => {
  assert.deepEqual(categoryChoices(categories, 'daily').children.map(c => c.id), ['supplies']);
  assert.deepEqual(categoryChoices(categories, 'other').children, []);
  assert.equal(categoryChoices(categories, '').parent, undefined);
  assert.deepEqual(categoryChoices(categories, '').children, []);
});

test('editing retains selected archived categories and their parent without exposing unused archived options', () => {
  assert.deepEqual(categoryChoices(categories, 'old').children.map(c => c.id), ['grocery', 'dining', 'old']);
  const choices = categoryChoices(categories, 'retired-child');
  assert.equal(choices.parent?.id, 'retired');
  assert.ok(choices.parents.some(c => c.id === 'retired'));
  assert.deepEqual(choices.children.map(c => c.id), ['retired-child']);
  assert.deepEqual(categoryChoices(categories, 'retired').children, []);
  assert.deepEqual(categoryChoices(categories, 'food').children.map(c => c.id), ['grocery', 'dining']);
});

test('filters include archived parents and details for historic expenses', () => {
  assert.ok(categoryChoices(categories, '', true).parents.some(c => c.id === 'retired'));
  assert.deepEqual(categoryChoices(categories, 'food', true).children.map(c => c.id), ['grocery', 'dining', 'old']);
  assert.deepEqual(categoryChoices(categories, 'retired', true).children.map(c => c.id), ['retired-child']);
});

test('master refresh derives a moved child from its current parent without changing the saved category', () => {
  const refreshed = categories.map(category => category.id === 'dining' ? { ...category, parentId: 'daily', color: '#B35F79' } : category);
  assert.equal(categoryChoices(refreshed, 'dining').parent?.id, 'daily');
  assert.equal(categoryChoices(refreshed, 'dining').children.find(c => c.id === 'dining')?.color, '#B35F79');
});
