'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useLedgerData } from '@/lib/ledger/use-ledger-data';
import type { Category, CategoryInput, SubCategory } from '@/lib/ledger/types';

type CategoryForm = {
  id: string;
  name: string;
  subCategoryNames: string;
};

function createCategoryId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `cat-custom-${crypto.randomUUID()}`;
  }
  return `cat-custom-${Date.now()}`;
}

function createSubCategoryId(categoryId: string, index: number) {
  return `${categoryId}-sub-${index + 1}`;
}

function emptyForm(): CategoryForm {
  return {
    id: createCategoryId(),
    name: '',
    subCategoryNames: '未分類',
  };
}

function toForm(category: Category): CategoryForm {
  return {
    id: category.id,
    name: category.name,
    subCategoryNames: category.subCategories.map((subCategory) => subCategory.name).join('\n'),
  };
}

function toInput(form: CategoryForm, existing?: Category): CategoryInput {
  const names = form.subCategoryNames
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);
  const fallbackNames = names.length ? names : ['未分類'];
  const existingByName = new Map(existing?.subCategories.map((subCategory) => [subCategory.name, subCategory]));
  const subCategories: SubCategory[] = fallbackNames.map((name, index) => {
    const current = existingByName.get(name);
    return {
      id: current?.id || createSubCategoryId(form.id, index),
      name,
      isActive: current?.isActive ?? true,
      sortOrder: (index + 1) * 10,
    };
  });

  return {
    id: form.id,
    name: form.name.trim(),
    isActive: existing?.isActive ?? true,
    sortOrder: existing?.sortOrder ?? 500,
    subCategories,
  };
}

export default function CategoriesPage() {
  const ledger = useLedgerData();
  const ledgerCategories = ledger.categories;
  const refreshLedger = ledger.refresh;
  const [form, setForm] = useState<CategoryForm>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    refreshLedger(new Date().toISOString().slice(0, 7));
  }, [refreshLedger]);

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const existing = ledgerCategories.find((category) => category.id === editingId);
    const input = toInput(form, existing);
    if (!input.name) return;
    await ledger.upsertCategory(input);
    setEditingId(null);
    setForm(emptyForm());
    await refreshLedger(new Date().toISOString().slice(0, 7));
  };

  const editCategory = (category: Category) => {
    setEditingId(category.id);
    setForm(toForm(category));
  };

  const deactivateCategory = async (category: Category) => {
    if (!window.confirm(`${category.name} を非表示にしますか？過去データは残ります。`)) return;
    await ledger.deactivateCategory(category.id);
    await refreshLedger(new Date().toISOString().slice(0, 7));
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  return (
    <main className="app-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Categories</p>
          <h1>カテゴリ管理</h1>
          <p className="lead">IDは変えずに表示名を編集できます。削除は非表示扱いなので、過去の集計は壊れません。</p>
        </div>
        <Link className="text-link" href="/">家計簿へ戻る</Link>
      </header>

      {ledger.error && <p className="error-banner">{ledger.error}</p>}

      <section className="category-layout">
        <form className="panel category-form" onSubmit={saveCategory}>
          <div>
            <p className="eyebrow">{editingId ? 'Edit' : 'New'}</p>
            <h2>{editingId ? 'カテゴリを編集' : 'カテゴリを追加'}</h2>
          </div>
          <label>
            カテゴリ名
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例：医療費" required />
          </label>
          <label>
            サブカテゴリ（1行に1つ）
            <textarea value={form.subCategoryNames} onChange={(event) => setForm({ ...form, subCategoryNames: event.target.value })} />
          </label>
          <p className="note">既存カテゴリを編集するときもIDは維持します。サブカテゴリ名を変えた場合、同名のものは同じIDを維持し、新しい行は新規IDになります。</p>
          <div className="form-actions">
            {editingId && <button type="button" onClick={cancel}>キャンセル</button>}
            <button className="primary-button" type="submit">保存</button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">List</p>
              <h2>カテゴリ一覧</h2>
            </div>
          </div>
          <div className="category-list">
            {ledgerCategories.map((category) => (
              <article className={`category-item ${category.isActive ? '' : 'inactive'}`} key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <span>{category.id}</span>
                  <p>{category.subCategories.map((subCategory) => subCategory.name).join(' / ')}</p>
                </div>
                <div className="actions">
                  <button onClick={() => editCategory(category)}>編集</button>
                  {category.isActive && <button onClick={() => deactivateCategory(category)}>非表示</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
