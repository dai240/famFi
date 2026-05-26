'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { uncategorizedCategoryId, uncategorizedSubCategoryId } from '@/lib/ledger/category-presets';
import { calculateSettlement, toMonthInputValue, type SettlementRule } from '@/lib/ledger/calculations';
import { getCurrentMonth, useLedgerData } from '@/lib/ledger/use-ledger-data';
import type { Category, Deposit, DepositInput, Expense, ExpenseFilters, ExpenseInput, ExpenseSource, Payer } from '@/lib/ledger/types';
import { payerLabels, sourceLabels } from '@/lib/ledger/types';

type View = 'expenses' | 'deposits' | 'review' | 'summary';
type CsvImportPreset = 'famfi' | 'rakuten-card' | 'bank';
type ExpenseForm = ExpenseInput;
type DepositForm = DepositInput;
type QuickTemplate = Pick<ExpenseInput, 'item' | 'categoryId' | 'subCategoryId' | 'payer' | 'source' | 'beneficiary'> & {
  id: string;
  label: string;
  amount?: number;
  description?: string;
};

const initialBalanceStorageKey = 'famfi:mvp:initial-balance';
const templateStorageKey = 'famfi:mvp:expense-templates';
const settlementRuleStorageKey = 'famfi:mvp:settlement-rule';
const localDataKeys = [
  'famfi:mvp:expenses',
  'famfi:mvp:deposits',
  'famfi:mvp:categories',
  initialBalanceStorageKey,
  templateStorageKey,
  settlementRuleStorageKey,
];

const currencyFormatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function toDisplayMonth(month: string) {
  const [year, value] = month.replace('/', '-').split('-');
  return `${year}年${Number(value)}月`;
}

function getVisibleSubCategories(category?: Category) {
  return category?.subCategories.filter((subCategory) => subCategory.isActive) || [];
}

function getInitialCategory(categories: Category[]) {
  return categories.find((category) => category.isActive) || categories[0];
}

function createExpenseForm(month: string, categories: Category[]): ExpenseForm {
  const category = getInitialCategory(categories);
  const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
  return {
    accountingMonth: month,
    date: new Date().toISOString().slice(0, 10),
    categoryId: category?.id || uncategorizedCategoryId,
    subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
    item: '',
    description: '',
    amount: 0,
    payer: 'father',
    source: 'rakuten',
    reimbursed: false,
    beneficiary: '',
    comment: '',
  };
}

function createDepositForm(): DepositForm {
  return {
    date: new Date().toISOString().slice(0, 10),
    depositor: 'father',
    amount: 0,
    description: '共通口座へ入金',
    comment: '',
  };
}

function defaultSettlementRule(): SettlementRule {
  return { mode: 'equal' };
}

function createTemplateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tpl-${crypto.randomUUID()}`;
  }
  return `tpl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredNumber(key: string) {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function escapeCsv(value: string | number | boolean | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | undefined>>) {
  return [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, csv: string) {
  downloadText(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeCsvDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed
    .replace(/[年月]/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-')
    .replace(/\./g, '-');
  const parts = normalized.split('-').map((part) => part.padStart(2, '0'));
  if (parts.length >= 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  return trimmed;
}

function parseCsvAmount(value: string) {
  const normalized = value.replace(/[￥¥,\s]/g, '').replace(/^△/, '-');
  const amount = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [view, setView] = useState<View>('expenses');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState<'all' | Payer>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ExpenseSource>('all');
  const [csvImportPreset, setCsvImportPreset] = useState<CsvImportPreset>('famfi');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState(0);
  const [settlementRule, setSettlementRule] = useState<SettlementRule>(() => defaultSettlementRule());
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templateForm, setTemplateForm] = useState<QuickTemplate>(() => ({
    id: createTemplateId(),
    label: '',
    item: '',
    categoryId: uncategorizedCategoryId,
    subCategoryId: uncategorizedSubCategoryId,
    amount: 0,
    payer: 'father',
    source: 'rakuten',
    beneficiary: '家族',
    description: '',
  }));
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(() => createExpenseForm(getCurrentMonth(), []));
  const [depositForm, setDepositForm] = useState<DepositForm>(() => createDepositForm());

  const ledger = useLedgerData();
  const ledgerCategories = ledger.categories;
  const refreshLedger = ledger.refresh;

  useEffect(() => {
    setInitialBalance(readStoredNumber(initialBalanceStorageKey));
    setSettlementRule(readStoredJson<SettlementRule>(settlementRuleStorageKey, defaultSettlementRule()));
    setTemplates(readStoredJson<QuickTemplate[]>(templateStorageKey, []));
    setTemplatesLoaded(true);
  }, []);

  const activeCategories = useMemo(() => ledgerCategories.filter((category) => category.isActive), [ledgerCategories]);
  const categoryById = useMemo(() => new Map(ledgerCategories.map((category) => [category.id, category])), [ledgerCategories]);
  const selectedCategory = categoryById.get(expenseForm.categoryId);
  const selectedSubCategories = getVisibleSubCategories(selectedCategory);
  const templateCategory = categoryById.get(templateForm.categoryId);
  const templateSubCategories = getVisibleSubCategories(templateCategory);

  const filters = useMemo<Partial<ExpenseFilters>>(
    () => ({
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      payer: payerFilter === 'all' ? undefined : payerFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
    }),
    [categoryFilter, payerFilter, sourceFilter],
  );

  useEffect(() => {
    refreshLedger(currentMonth, filters);
  }, [currentMonth, filters, refreshLedger]);

  useEffect(() => {
    if (!templatesLoaded || templates.length || activeCategories.length === 0) return;
    if (typeof window !== 'undefined' && window.localStorage.getItem(templateStorageKey) !== null) return;
    const findTemplateCategory = (categoryId: string, fallback = uncategorizedCategoryId) => {
      const category = activeCategories.find((entry) => entry.id === categoryId) || activeCategories.find((entry) => entry.id === fallback) || activeCategories[0];
      const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
      return { category, subCategory };
    };
    const housingTemplate = findTemplateCategory('cat-housing');
    const utilitiesTemplate = findTemplateCategory('cat-utilities');
    const foodTemplate = findTemplateCategory('cat-food');
    const defaultTemplates: QuickTemplate[] = [
      housingTemplate.category && housingTemplate.subCategory
        ? { id: createTemplateId(), label: '家賃・住居費', item: '家賃', categoryId: housingTemplate.category.id, subCategoryId: housingTemplate.subCategory.id, payer: 'father', source: 'rakuten', beneficiary: '家族' }
        : undefined,
      utilitiesTemplate.category && utilitiesTemplate.subCategory
        ? { id: createTemplateId(), label: '光熱費', item: '光熱費', categoryId: utilitiesTemplate.category.id, subCategoryId: utilitiesTemplate.subCategory.id, payer: 'father', source: 'rakuten', beneficiary: '家族' }
        : undefined,
      foodTemplate.category && foodTemplate.subCategory
        ? { id: createTemplateId(), label: '食材', item: '食材', categoryId: foodTemplate.category.id, subCategoryId: foodTemplate.subCategory.id, payer: 'mother', source: 'advance', beneficiary: '家族' }
        : undefined,
    ].filter(Boolean) as QuickTemplate[];
    setTemplates(defaultTemplates);
    writeStoredJson(templateStorageKey, defaultTemplates);
  }, [activeCategories, templates.length, templatesLoaded]);

  useEffect(() => {
    if (!showExpenseForm) return;
    const category = categoryById.get(expenseForm.categoryId) || getInitialCategory(ledgerCategories);
    const subCategories = getVisibleSubCategories(category);
    if (category && !subCategories.some((subCategory) => subCategory.id === expenseForm.subCategoryId)) {
      setExpenseForm((current) => ({
        ...current,
        categoryId: category.id,
        subCategoryId: subCategories[0]?.id || category.subCategories[0]?.id || uncategorizedSubCategoryId,
      }));
    }
  }, [categoryById, expenseForm.categoryId, expenseForm.subCategoryId, ledgerCategories, showExpenseForm]);

  useEffect(() => {
    if (!showTemplateManager) return;
    const category = categoryById.get(templateForm.categoryId) || getInitialCategory(ledgerCategories);
    const subCategories = getVisibleSubCategories(category);
    if (category && !subCategories.some((subCategory) => subCategory.id === templateForm.subCategoryId)) {
      setTemplateForm((current) => ({
        ...current,
        categoryId: category.id,
        subCategoryId: subCategories[0]?.id || category.subCategories[0]?.id || uncategorizedSubCategoryId,
      }));
    }
  }, [categoryById, ledgerCategories, showTemplateManager, templateForm.categoryId, templateForm.subCategoryId]);

  const refresh = () => refreshLedger(currentMonth, filters);

  const saveInitialBalance = (value: number) => {
    const nextValue = Number.isFinite(value) ? value : 0;
    setInitialBalance(nextValue);
    window.localStorage.setItem(initialBalanceStorageKey, String(nextValue));
  };

  const saveSettlementRule = (rule: SettlementRule) => {
    setSettlementRule(rule);
    writeStoredJson(settlementRuleStorageKey, rule);
  };

  const startNewExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm(createExpenseForm(currentMonth, ledgerCategories));
    setShowExpenseForm(true);
  };

  const startExpenseFromTemplate = (template: QuickTemplate) => {
    setEditingExpenseId(null);
    setExpenseForm({
      ...createExpenseForm(currentMonth, ledgerCategories),
      item: template.item,
      categoryId: template.categoryId,
      subCategoryId: template.subCategoryId,
      amount: template.amount || 0,
      payer: template.payer,
      source: template.source,
      beneficiary: template.beneficiary,
      description: template.description || '',
    });
    setShowExpenseForm(true);
  };

  const startTemplateFromCurrentForm = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      id: createTemplateId(),
      label: expenseForm.item || '新しいテンプレート',
      item: expenseForm.item,
      categoryId: expenseForm.categoryId,
      subCategoryId: expenseForm.subCategoryId,
      amount: expenseForm.amount,
      payer: expenseForm.payer,
      source: expenseForm.source,
      beneficiary: expenseForm.beneficiary,
      description: expenseForm.description,
    });
    setShowExpenseForm(false);
    setShowTemplateManager(true);
  };

  const editTemplate = (template: QuickTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateForm({ ...template });
    setShowTemplateManager(true);
  };

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      id: createTemplateId(),
      label: '',
      item: '',
      categoryId: activeCategories[0]?.id || uncategorizedCategoryId,
      subCategoryId: getVisibleSubCategories(activeCategories[0])[0]?.id || activeCategories[0]?.subCategories[0]?.id || uncategorizedSubCategoryId,
      amount: 0,
      payer: 'father',
      source: 'rakuten',
      beneficiary: '家族',
      description: '',
    });
  };

  const saveTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTemplate = {
      ...templateForm,
      label: templateForm.label.trim(),
      item: templateForm.item.trim(),
      amount: Number(templateForm.amount || 0),
    };
    if (!nextTemplate.label || !nextTemplate.item) return;
    const nextTemplates = editingTemplateId
      ? templates.map((template) => (template.id === editingTemplateId ? nextTemplate : template))
      : [...templates, nextTemplate];
    setTemplates(nextTemplates);
    writeStoredJson(templateStorageKey, nextTemplates);
    resetTemplateForm();
  };

  const deleteTemplate = (templateId: string) => {
    if (!window.confirm('このテンプレートを削除しますか？')) return;
    const nextTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(nextTemplates);
    writeStoredJson(templateStorageKey, nextTemplates);
    if (editingTemplateId === templateId) resetTemplateForm();
  };

  const duplicateExpense = (expense: Expense) => {
    setEditingExpenseId(null);
    setExpenseForm({
      accountingMonth: currentMonth,
      date: new Date().toISOString().slice(0, 10),
      categoryId: expense.categoryId,
      subCategoryId: expense.subCategoryId,
      item: expense.item,
      description: expense.description,
      amount: expense.amount,
      payer: expense.payer,
      source: expense.source,
      reimbursed: false,
      beneficiary: expense.beneficiary,
      comment: expense.comment,
    });
    setShowExpenseForm(true);
  };

  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      accountingMonth: toMonthInputValue(expense.accountingMonth),
      date: expense.date || '',
      categoryId: expense.categoryId,
      subCategoryId: expense.subCategoryId,
      item: expense.item,
      description: expense.description,
      amount: expense.amount,
      payer: expense.payer,
      source: expense.source,
      reimbursed: expense.reimbursed,
      beneficiary: expense.beneficiary,
      comment: expense.comment,
    });
    setShowExpenseForm(true);
  };

  const saveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseForm.accountingMonth || !expenseForm.amount || expenseForm.amount < 0) return;
    const input = {
      ...expenseForm,
      accountingMonth: toMonthInputValue(expenseForm.accountingMonth),
      amount: Number(expenseForm.amount),
      reimbursed: expenseForm.source === 'advance' ? expenseForm.reimbursed : false,
    };
    if (editingExpenseId) {
      await ledger.updateExpense(editingExpenseId, input);
    } else {
      await ledger.createExpense(input);
    }
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    await refresh();
  };

  const deleteExpense = async (expense: Expense) => {
    if (!window.confirm(`No.${expense.no} の支出を削除しますか？`)) return;
    await ledger.deleteExpense(expense.id);
    await refresh();
  };

  const startNewDeposit = () => {
    setEditingDepositId(null);
    setDepositForm(createDepositForm());
    setShowDepositForm(true);
  };

  const editDeposit = (deposit: Deposit) => {
    setEditingDepositId(deposit.id);
    setDepositForm({
      date: deposit.date,
      depositor: deposit.depositor,
      amount: deposit.amount,
      description: deposit.description,
      comment: deposit.comment,
    });
    setShowDepositForm(true);
  };

  const saveDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!depositForm.date || !depositForm.amount || depositForm.amount < 0) return;
    const input = { ...depositForm, amount: Number(depositForm.amount) };
    if (editingDepositId) {
      await ledger.updateDeposit(editingDepositId, input);
    } else {
      await ledger.createDeposit(input);
    }
    setShowDepositForm(false);
    setEditingDepositId(null);
    await refresh();
  };

  const deleteDeposit = async (deposit: Deposit) => {
    if (!window.confirm(`No.${deposit.no} の入金を削除しますか？`)) return;
    await ledger.deleteDeposit(deposit.id);
    await refresh();
  };

  const selectCategory = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
    setExpenseForm((current) => ({
      ...current,
      categoryId,
      subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
    }));
  };

  const selectTemplateCategory = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    const subCategory = getVisibleSubCategories(category)[0] || category?.subCategories[0];
    setTemplateForm((current) => ({
      ...current,
      categoryId,
      subCategoryId: subCategory?.id || uncategorizedSubCategoryId,
    }));
  };

  const exportCurrentMonthCsv = () => {
    const expenseRows = monthExpenses.map((expense) => {
      const category = categoryById.get(expense.categoryId);
      const subCategory = category?.subCategories.find((item) => item.id === expense.subCategoryId);
      return [
        '支出',
        expense.no,
        expense.accountingMonth,
        expense.date,
        category?.name || '未分類',
        subCategory?.name || '未分類',
        expense.item,
        expense.amount,
        payerLabels[expense.payer],
        sourceLabels[expense.source],
        expense.reimbursed ? '精算済' : '',
        expense.description,
        expense.beneficiary,
        expense.comment,
      ];
    });
    const depositRows = monthDeposits.map((deposit) => [
      '入金',
      deposit.no,
      deposit.date.slice(0, 7),
      deposit.date,
      '',
      '',
      deposit.description,
      deposit.amount,
      payerLabels[deposit.depositor],
      '',
      '',
      '',
      '',
      deposit.comment,
    ]);
    const csv = buildCsv(
      ['種別', 'No', '計上年月', '日付', 'カテゴリ', 'サブカテゴリ', '内容', '金額', '人', '財源', '状態', 'メモ', '誰のため', 'コメント'],
      [...expenseRows, ...depositRows],
    );
    downloadCsv(`famfi-${currentMonth}.csv`, csv);
  };

  const importExpensesCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    const headers = splitCsvLine(lines[0] || '');
    const rows = lines.slice(1).map(splitCsvLine);
    const valueOf = (row: string[], names: string[], fallbackIndex: number) => {
      const headerIndex = names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
      return row[headerIndex ?? fallbackIndex] || '';
    };
    const uncategorizedCategory =
      ledgerCategories.find((entry) => entry.id === uncategorizedCategoryId) ||
      ledgerCategories[0];
    const uncategorizedSubCategory =
      uncategorizedCategory?.subCategories.find((entry) => entry.id === uncategorizedSubCategoryId) ||
      uncategorizedCategory?.subCategories[0];
    let imported = 0;
    for (const row of rows) {
      const rawType = valueOf(row, ['種別', 'type'], 0);
      const bankDepositAmount = parseCsvAmount(valueOf(row, ['入金', '入金額', '預入金額', 'deposit'], 8));
      const bankWithdrawalAmount = parseCsvAmount(valueOf(row, ['出金', '出金額', '支払金額', 'withdrawal'], 7));
      const type =
        csvImportPreset === 'bank'
          ? bankDepositAmount > 0
            ? '入金'
            : '支出'
          : rawType || '支出';
      const rawDate = valueOf(row, ['日付', 'date', '利用日', 'ご利用日', '取引日', 'お取引日'], csvImportPreset === 'famfi' ? 3 : 0);
      const date = normalizeCsvDate(rawDate);
      const accountingMonth = valueOf(row, ['計上年月', 'month'], 2) || date.slice(0, 7) || currentMonth;
      const categoryName = valueOf(row, ['カテゴリ', 'category'], 4);
      const subCategoryName = valueOf(row, ['サブカテゴリ', 'subcategory'], 5);
      const item = valueOf(row, ['内容', '品目', '店名', '摘要', 'ご利用店名', '利用店名', '利用店名・商品名', 'item'], csvImportPreset === 'famfi' ? 6 : 1);
      const amountText =
        csvImportPreset === 'bank'
          ? String(bankDepositAmount || bankWithdrawalAmount)
          : valueOf(row, ['金額', 'amount', '利用金額', 'ご利用金額', '支払金額'], csvImportPreset === 'famfi' ? 7 : 2);
      const person = valueOf(row, ['人', '支払者', '入金者', 'person'], 8);
      const source = valueOf(row, ['財源', 'source'], 9);
      const state = valueOf(row, ['状態', 'status'], 10);
      const description = valueOf(row, ['メモ', '説明', 'description'], 11);
      const beneficiary = valueOf(row, ['誰のため', 'beneficiary'], 12);
      const comment = valueOf(row, ['コメント', 'comment'], 13);
      const parsedAmount = Math.abs(parseCsvAmount(amountText));
      if (type === '入金') {
        if (!date || !parsedAmount) continue;
        await ledger.createDeposit({
          date,
          depositor: person === '母' ? 'mother' : 'father',
          amount: parsedAmount,
          description: item || '',
          comment: comment || '',
        });
        imported += 1;
        continue;
      }
      if (type && type !== '支出') continue;
      const category =
        ledgerCategories.find((entry) => entry.name === categoryName) ||
        uncategorizedCategory;
      const subCategory =
        category?.subCategories.find((entry) => entry.name === subCategoryName) ||
        uncategorizedSubCategory;
      if (!category || !subCategory || !parsedAmount) continue;
      await ledger.createExpense({
        accountingMonth: toMonthInputValue(accountingMonth || currentMonth),
        date: date || '',
        categoryId: category.id,
        subCategoryId: subCategory.id,
        item: item || '',
        description: description || '',
        amount: parsedAmount,
        payer: person === '母' ? 'mother' : 'father',
        source: source === '実費' ? 'personal' : source === '立替' ? 'advance' : csvImportPreset === 'rakuten-card' ? 'rakuten' : 'rakuten',
        reimbursed: state === '精算済',
        beneficiary: beneficiary || '',
        comment: comment || '',
      });
      imported += 1;
    }
    await refresh();
    window.alert(`${imported}件の記録を取り込みました。`);
  };

  const exportBackupJson = () => {
    const backup = Object.fromEntries(localDataKeys.map((key) => [key, window.localStorage.getItem(key)]));
    downloadText(
      `famfi-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8;',
    );
  };

  const importBackupJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse((await file.text()).replace(/^\uFEFF/, '')) as Record<string, string | null>;
      localDataKeys.forEach((key) => {
        const value = backup[key];
        if (typeof value === 'string') {
          window.localStorage.setItem(key, value);
        }
      });
      setInitialBalance(readStoredNumber(initialBalanceStorageKey));
      setTemplates(readStoredJson<QuickTemplate[]>(templateStorageKey, []));
      await refresh();
      window.alert('バックアップを復元しました。');
    } catch {
      window.alert('バックアップJSONを読み込めませんでした。');
    }
  };

  const resetLocalData = async () => {
    if (!window.confirm('localStorageの家計簿データを初期化しますか？この操作は元に戻せません。')) return;
    localDataKeys.forEach((key) => window.localStorage.removeItem(key));
    setInitialBalance(0);
    setTemplates([]);
    setTemplatesLoaded(false);
    setTimeout(() => setTemplatesLoaded(true), 0);
    await refresh();
  };

  const monthExpenses = ledger.expenses;
  const monthDeposits = ledger.deposits;
  const currentSummaryIndex = ledger.summaryRows.findIndex((row) => row.month === currentMonth);
  const previousSummary = currentSummaryIndex > 0 ? ledger.summaryRows[currentSummaryIndex - 1] : undefined;
  const currentCumulative = initialBalance + (ledger.summaryRows.find((row) => row.month === currentMonth)?.cumulative || 0);
  const balanceChange = previousSummary ? ledger.summary.totalExpenses - previousSummary.totalExpenses : ledger.summary.totalExpenses;
  const sharedPaidByFather = monthExpenses
    .filter((expense) => expense.source !== 'personal' && expense.payer === 'father')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const sharedPaidByMother = monthExpenses
    .filter((expense) => expense.source !== 'personal' && expense.payer === 'mother')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const fatherDepositTotal = monthDeposits
    .filter((deposit) => deposit.depositor === 'father')
    .reduce((sum, deposit) => sum + deposit.amount, 0);
  const motherDepositTotal = monthDeposits
    .filter((deposit) => deposit.depositor === 'mother')
    .reduce((sum, deposit) => sum + deposit.amount, 0);
  const fatherContribution = fatherDepositTotal + sharedPaidByFather;
  const motherContribution = motherDepositTotal + sharedPaidByMother;
  const settlement = calculateSettlement({ fatherContribution, motherContribution, rule: settlementRule });
  const settlementAmount = settlement.amount;
  const settlementText =
    settlementAmount === 0
      ? '精算は不要です'
      : `${payerLabels[settlement.payer!]}から${payerLabels[settlement.receiver!]}へ ${formatCurrency(settlementAmount)}`;
  const unreimbursedAdvance = monthExpenses
    .filter((expense) => expense.source === 'advance' && !expense.reimbursed)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const latestExpense = monthExpenses[0];
  const categoryTotals = activeCategories
    .map((category) => ({
      category,
      total: monthExpenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const topExpenses = [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const unreimbursedExpenses = monthExpenses.filter((expense) => expense.source === 'advance' && !expense.reimbursed);
  const maxCategoryTotal = Math.max(...categoryTotals.map((row) => row.total), 1);
  const maxChartValue = Math.max(...ledger.summaryRows.map((row) => Math.max(row.depositTotal, row.sharedExpenses)), 1);

  return (
    <main className="app-shell">
      <header className="dashboard-top">
        <div>
          <p className="eyebrow">FamFi</p>
          <h1>{toDisplayMonth(currentMonth)}の家計メモ</h1>
          <p className="lead">
            共通支出、入金、立替の状態をひと目で確認できます。保存先は {ledger.backend === 'local' ? 'localStorage' : 'DB'} です。
          </p>
        </div>
        <div className="hero-actions">
          <Link className="text-link" href="/categories">カテゴリ管理</Link>
          <label className="month-picker">
            <span>計上年月</span>
            <input type="month" value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)} />
          </label>
        </div>
      </header>

      {ledger.error && <p className="error-banner">{ledger.error}</p>}

      <section className="month-command">
        <div>
          <span className={`status-pill ${ledger.summary.sharedBalance >= 0 ? 'good' : 'bad'}`}>
            {ledger.summary.sharedBalance >= 0 ? '共通費は黒字' : '共通費が不足'}
          </span>
          <h2>{ledger.summary.sharedBalance >= 0 ? '今月の共通プールは余裕があります' : '入金か立替精算を確認しましょう'}</h2>
          <p>
            共通支出 {formatCurrency(ledger.summary.sharedExpenses)} に対して、入金は {formatCurrency(ledger.summary.depositTotal)} です。
            目安は父 {formatCurrency(settlement.fatherTarget)} / 母 {formatCurrency(settlement.motherTarget)}、今月の精算は「{settlementText}」です。
          </p>
        </div>
        <div className="command-actions">
          <button className="primary-button" onClick={startNewExpense}>支出を追加</button>
          <button onClick={startNewDeposit}>入金を追加</button>
        </div>
      </section>

      <section className="metric-strip">
        <MetricCard label="支出合計" value={formatCurrency(ledger.summary.totalExpenses)} />
        <MetricCard label="共通支出" value={formatCurrency(ledger.summary.sharedExpenses)} />
        <MetricCard label="実費支出" value={formatCurrency(ledger.summary.personalExpenses)} />
        <MetricCard label="入金合計" value={formatCurrency(ledger.summary.depositTotal)} />
        <MetricCard label="差分" value={formatCurrency(ledger.summary.sharedBalance)} tone={ledger.summary.sharedBalance >= 0 ? 'good' : 'bad'} />
        <MetricCard label="共通プール残高" value={formatCurrency(currentCumulative)} tone={currentCumulative >= 0 ? 'good' : 'bad'} />
      </section>

      <section className="utility-panel">
        <label>
          初期残高
          <input
            type="number"
            value={initialBalance || ''}
            onChange={(event) => saveInitialBalance(Number(event.target.value || 0))}
            placeholder="共通プールの開始残高"
          />
        </label>
        <div className="settlement-controls">
          <label>
            精算ルール
            <select
              value={settlementRule.mode}
              onChange={(event) => saveSettlementRule(event.target.value === 'ratio' ? { mode: 'ratio', fatherShare: 50, motherShare: 50 } : { mode: 'equal' })}
            >
              <option value="equal">折半</option>
              <option value="ratio">比率</option>
            </select>
          </label>
          {settlementRule.mode === 'ratio' && (
            <>
              <label>
                父の比率
                <input
                  type="number"
                  min="0"
                  value={settlementRule.fatherShare}
                  onChange={(event) => saveSettlementRule({ ...settlementRule, fatherShare: Number(event.target.value || 0) })}
                />
              </label>
              <label>
                母の比率
                <input
                  type="number"
                  min="0"
                  value={settlementRule.motherShare}
                  onChange={(event) => saveSettlementRule({ ...settlementRule, motherShare: Number(event.target.value || 0) })}
                />
              </label>
            </>
          )}
        </div>
        <div className="quick-templates">
          <span>よく使う支出</span>
          {templates.slice(0, 5).map((template) => (
            <button key={template.id} onClick={() => startExpenseFromTemplate(template)}>{template.label}</button>
          ))}
          <button onClick={() => setShowTemplateManager(true)}>テンプレート管理</button>
          {latestExpense && <button onClick={() => duplicateExpense(latestExpense)}>最新支出を複製</button>}
        </div>
        <div className="csv-actions">
          <button onClick={exportCurrentMonthCsv}>CSV出力</button>
          <label className="csv-preset">
            取込形式
            <select value={csvImportPreset} onChange={(event) => setCsvImportPreset(event.target.value as CsvImportPreset)}>
              <option value="famfi">FamFi</option>
              <option value="rakuten-card">楽天カード</option>
              <option value="bank">銀行明細</option>
            </select>
          </label>
          <label className="file-button">
            CSV取込
            <input type="file" accept=".csv,text/csv" onChange={importExpensesCsv} />
          </label>
          <button onClick={exportBackupJson}>バックアップ</button>
          <label className="file-button">
            復元
            <input type="file" accept=".json,application/json" onChange={importBackupJson} />
          </label>
          <button onClick={resetLocalData}>初期化</button>
        </div>
      </section>

      <section className="insight-grid">
        <article className="panel insight-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Check</p>
              <h2>今月の確認ポイント</h2>
            </div>
          </div>
          <div className="check-list">
            <CheckItem label="未精算の立替" value={formatCurrency(unreimbursedAdvance)} danger={unreimbursedAdvance > 0} />
            <CheckItem label="父が払った共通費" value={formatCurrency(sharedPaidByFather)} />
            <CheckItem label="母が払った共通費" value={formatCurrency(sharedPaidByMother)} />
            <CheckItem label="最新の支出" value={latestExpense ? `${latestExpense.item || '名称なし'} / ${formatCurrency(latestExpense.amount)}` : 'まだありません'} />
          </div>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Category</p>
              <h2>支出が多いカテゴリ</h2>
            </div>
          </div>
          <div className="category-bars">
            {categoryTotals.map((row) => (
              <div className="category-bar" key={row.category.id}>
                <span>{row.category.name}</span>
                <div><i style={{ width: `${(row.total / maxCategoryTotal) * 100}%` }} /></div>
                <strong>{formatCurrency(row.total)}</strong>
              </div>
            ))}
            {categoryTotals.length === 0 && <p className="empty-note">支出を追加すると、カテゴリ別の偏りが見えるようになります。</p>}
          </div>
        </article>
      </section>

      <nav className="tabs" aria-label="家計簿メニュー">
        <button className={view === 'expenses' ? 'active' : ''} onClick={() => setView('expenses')}>支出</button>
        <button className={view === 'deposits' ? 'active' : ''} onClick={() => setView('deposits')}>入金</button>
        <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>月次レビュー</button>
        <button className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>月次推移</button>
      </nav>

      {view === 'expenses' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Expenses</p>
              <h2>{toDisplayMonth(currentMonth)}の支出</h2>
            </div>
            <button className="primary-button" onClick={startNewExpense}>支出を追加</button>
          </div>

          <div className="filters">
            <label>
              カテゴリ
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">すべて</option>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>
              支払者
              <select value={payerFilter} onChange={(event) => setPayerFilter(event.target.value as 'all' | Payer)}>
                <option value="all">すべて</option>
                <option value="father">父</option>
                <option value="mother">母</option>
              </select>
            </label>
            <label>
              財源
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | ExpenseSource)}>
                <option value="all">すべて</option>
                <option value="rakuten">楽天</option>
                <option value="advance">立替</option>
                <option value="personal">実費</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>No</th><th>日付</th><th>分類</th><th>内容</th><th>金額</th><th>支払者</th><th>財源</th><th>状態</th><th>操作</th></tr>
              </thead>
              <tbody>
                {monthExpenses.map((expense) => {
                  const category = categoryById.get(expense.categoryId);
                  const subCategory = category?.subCategories.find((item) => item.id === expense.subCategoryId);
                  return (
                    <tr key={expense.id}>
                      <td>{expense.no}</td>
                      <td>{expense.date || `${toDisplayMonth(expense.accountingMonth)}分`}</td>
                      <td><strong>{category?.name || '未分類'}</strong><span>{subCategory?.name || '未分類'}</span></td>
                      <td><strong>{expense.item || '-'}</strong>{expense.description && <span>{expense.description}</span>}</td>
                      <td className="amount">{formatCurrency(expense.amount)}</td>
                      <td>{payerLabels[expense.payer]}</td>
                      <td>{sourceLabels[expense.source]}</td>
                      <td>{expense.source === 'advance' ? (expense.reimbursed ? '精算済' : '未精算') : '-'}</td>
                      <td className="actions"><button onClick={() => duplicateExpense(expense)}>複製</button><button onClick={() => editExpense(expense)}>編集</button><button onClick={() => deleteExpense(expense)}>削除</button></td>
                    </tr>
                  );
                })}
                {monthExpenses.length === 0 && <EmptyRow colSpan={9} text={ledger.isLoading ? '読み込み中です。' : 'まずは右上の「支出を追加」から、今月の共通支出を1件入れてみましょう。'} />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'deposits' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Deposits</p>
              <h2>{toDisplayMonth(currentMonth)}の入金</h2>
            </div>
            <button className="primary-button" onClick={startNewDeposit}>入金を追加</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>No</th><th>日付</th><th>入金者</th><th>説明</th><th>金額</th><th>コメント</th><th>操作</th></tr></thead>
              <tbody>
                {monthDeposits.map((deposit) => (
                  <tr key={deposit.id}>
                    <td>{deposit.no}</td>
                    <td>{deposit.date}</td>
                    <td>{payerLabels[deposit.depositor]}</td>
                    <td>{deposit.description || '-'}</td>
                    <td className="amount">{formatCurrency(deposit.amount)}</td>
                    <td>{deposit.comment || '-'}</td>
                    <td className="actions"><button onClick={() => editDeposit(deposit)}>編集</button><button onClick={() => deleteDeposit(deposit)}>削除</button></td>
                  </tr>
                ))}
                {monthDeposits.length === 0 && <EmptyRow colSpan={7} text={ledger.isLoading ? '読み込み中です。' : 'この月の入金はまだありません。'} />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'review' && (
        <section className="review-grid">
          <article className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Review</p>
                <h2>今月のまとめ</h2>
              </div>
            </div>
            <div className="review-summary">
              <CheckItem label="前月比の支出" value={`${balanceChange >= 0 ? '+' : ''}${formatCurrency(balanceChange)}`} danger={balanceChange > 0} />
              <CheckItem label="精算目安" value={settlementText} danger={settlementAmount > 0} />
              <CheckItem label="未精算の立替" value={formatCurrency(unreimbursedAdvance)} danger={unreimbursedAdvance > 0} />
              <CheckItem label="共通プール残高" value={formatCurrency(currentCumulative)} danger={currentCumulative < 0} />
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Top</p>
                <h2>大きい支出</h2>
              </div>
            </div>
            <div className="simple-list">
              {topExpenses.map((expense) => (
                <button key={expense.id} onClick={() => duplicateExpense(expense)}>
                  <span>{expense.item || '名称なし'}</span>
                  <strong>{formatCurrency(expense.amount)}</strong>
                </button>
              ))}
              {topExpenses.length === 0 && <p className="empty-note">支出が入ると、金額の大きい順に確認できます。</p>}
            </div>
          </article>

          <article className="panel review-wide">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Advance</p>
                <h2>未精算の立替一覧</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>日付</th><th>内容</th><th>支払者</th><th>金額</th><th>操作</th></tr></thead>
                <tbody>
                  {unreimbursedExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{expense.date || '-'}</td>
                      <td>{expense.item || '-'}</td>
                      <td>{payerLabels[expense.payer]}</td>
                      <td className="amount">{formatCurrency(expense.amount)}</td>
                      <td className="actions"><button onClick={() => editExpense(expense)}>精算状態を編集</button></td>
                    </tr>
                  ))}
                  {unreimbursedExpenses.length === 0 && <EmptyRow colSpan={5} text="未精算の立替はありません。" />}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {view === 'summary' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Trend</p>
              <h2>月次推移</h2>
            </div>
          </div>
          <div className="chart" aria-label="入金と共通支出の比較">
            {ledger.summaryRows.map((row) => (
              <div className="chart-row" key={row.month}>
                <span>{toDisplayMonth(row.month)}</span>
                <div className="bars">
                  <div className="bar deposit" style={{ width: `${(row.depositTotal / maxChartValue) * 100}%` }}>入金 {formatCurrency(row.depositTotal)}</div>
                  <div className="bar expense" style={{ width: `${(row.sharedExpenses / maxChartValue) * 100}%` }}>共通 {formatCurrency(row.sharedExpenses)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>月</th><th>支出合計</th><th>共通支出</th><th>実費支出</th><th>入金合計</th><th>差分</th><th>累計</th></tr></thead>
              <tbody>
                {ledger.summaryRows.map((row) => (
                  <tr key={row.month}>
                    <td>{toDisplayMonth(row.month)}</td>
                    <td className="amount">{formatCurrency(row.totalExpenses)}</td>
                    <td className="amount">{formatCurrency(row.sharedExpenses)}</td>
                    <td className="amount">{formatCurrency(row.personalExpenses)}</td>
                    <td className="amount">{formatCurrency(row.depositTotal)}</td>
                    <td className="amount">{formatCurrency(row.sharedBalance)}</td>
                    <td className="amount">{formatCurrency(row.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showTemplateManager && (
        <Modal title="支出テンプレート管理" onClose={() => setShowTemplateManager(false)}>
          <div className="template-manager">
            <form className="record-form" onSubmit={saveTemplate}>
              <label>ボタン名<input required value={templateForm.label} onChange={(event) => setTemplateForm({ ...templateForm, label: event.target.value })} placeholder="例: 保育園" /></label>
              <label>内容<input required value={templateForm.item} onChange={(event) => setTemplateForm({ ...templateForm, item: event.target.value })} placeholder="店名や品目" /></label>
              <label>カテゴリ<select required value={templateForm.categoryId} onChange={(event) => selectTemplateCategory(event.target.value)}>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label>サブカテゴリ<select required value={templateForm.subCategoryId} onChange={(event) => setTemplateForm({ ...templateForm, subCategoryId: event.target.value })}>{templateSubCategories.map((subCategory) => <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>)}</select></label>
              <label>金額<input type="number" min="0" value={templateForm.amount || ''} onChange={(event) => setTemplateForm({ ...templateForm, amount: Number(event.target.value) })} placeholder="未入力でもOK" /></label>
              <label>支払者<select value={templateForm.payer} onChange={(event) => setTemplateForm({ ...templateForm, payer: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
              <label>財源<select value={templateForm.source} onChange={(event) => setTemplateForm({ ...templateForm, source: event.target.value as ExpenseSource })}><option value="rakuten">楽天</option><option value="advance">立替</option><option value="personal">実費</option></select></label>
              <label>誰のため<input value={templateForm.beneficiary} onChange={(event) => setTemplateForm({ ...templateForm, beneficiary: event.target.value })} placeholder="例: 家族" /></label>
              <label>メモ<textarea value={templateForm.description || ''} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} /></label>
              <div className="form-actions">
                {editingTemplateId && <button type="button" onClick={resetTemplateForm}>新規作成に戻る</button>}
                <button className="primary-button" type="submit">{editingTemplateId ? '更新' : '追加'}</button>
              </div>
            </form>
            <div className="template-list">
              {templates.map((template) => (
                <article className="template-item" key={template.id}>
                  <div>
                    <strong>{template.label}</strong>
                    <span>{template.item} / {formatCurrency(template.amount || 0)} / {sourceLabels[template.source]}</span>
                  </div>
                  <div className="actions">
                    <button onClick={() => startExpenseFromTemplate(template)}>使う</button>
                    <button onClick={() => editTemplate(template)}>編集</button>
                    <button onClick={() => deleteTemplate(template.id)}>削除</button>
                  </div>
                </article>
              ))}
              {templates.length === 0 && <p className="empty-note">よく使う支出を追加すると、トップからすぐ入力できます。</p>}
            </div>
          </div>
        </Modal>
      )}

      {showExpenseForm && (
        <Modal title={editingExpenseId ? '支出を編集' : '支出を追加'} onClose={() => setShowExpenseForm(false)}>
          <form className="record-form" onSubmit={saveExpense}>
            <label>計上年月<input type="month" required value={expenseForm.accountingMonth} onChange={(event) => setExpenseForm({ ...expenseForm, accountingMonth: event.target.value })} /></label>
            <label>日付<input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} /></label>
            <label>カテゴリ<select required value={expenseForm.categoryId} onChange={(event) => selectCategory(event.target.value)}>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>サブカテゴリ<select required value={expenseForm.subCategoryId} onChange={(event) => setExpenseForm({ ...expenseForm, subCategoryId: event.target.value })}>{selectedSubCategories.map((subCategory) => <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>)}</select></label>
            <label>内容<input value={expenseForm.item} onChange={(event) => setExpenseForm({ ...expenseForm, item: event.target.value })} placeholder="店名や品目" /></label>
            <label>金額<input type="number" min="0" required value={expenseForm.amount || ''} onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })} /></label>
            <label>支払者<select value={expenseForm.payer} onChange={(event) => setExpenseForm({ ...expenseForm, payer: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
            <label>財源<select value={expenseForm.source} onChange={(event) => setExpenseForm({ ...expenseForm, source: event.target.value as ExpenseSource, reimbursed: false })}><option value="rakuten">楽天</option><option value="advance">立替</option><option value="personal">実費</option></select></label>
            {expenseForm.source === 'advance' && <label className="checkbox"><input type="checkbox" checked={expenseForm.reimbursed} onChange={(event) => setExpenseForm({ ...expenseForm, reimbursed: event.target.checked })} />精算済みにする</label>}
            {expenseForm.source === 'personal' && <p className="note">実費は支出合計には含めますが、共通プールの差分には含めません。</p>}
            <label>メモ<textarea value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="レシート内容や補足" /></label>
            <label>誰のため<input value={expenseForm.beneficiary} onChange={(event) => setExpenseForm({ ...expenseForm, beneficiary: event.target.value })} placeholder="例: 家族 / 子ども / 父" /></label>
            <label>コメント<textarea value={expenseForm.comment} onChange={(event) => setExpenseForm({ ...expenseForm, comment: event.target.value })} /></label>
            <div className="form-actions">
              <button type="button" onClick={() => setShowExpenseForm(false)}>キャンセル</button>
              <button type="button" onClick={startTemplateFromCurrentForm}>テンプレート化</button>
              <button className="primary-button" type="submit">保存</button>
            </div>
          </form>
        </Modal>
      )}

      {showDepositForm && (
        <Modal title={editingDepositId ? '入金を編集' : '入金を追加'} onClose={() => setShowDepositForm(false)}>
          <form className="record-form" onSubmit={saveDeposit}>
            <label>日付<input type="date" required value={depositForm.date} onChange={(event) => setDepositForm({ ...depositForm, date: event.target.value })} /></label>
            <label>入金者<select value={depositForm.depositor} onChange={(event) => setDepositForm({ ...depositForm, depositor: event.target.value as Payer })}><option value="father">父</option><option value="mother">母</option></select></label>
            <label>金額<input type="number" min="0" required value={depositForm.amount || ''} onChange={(event) => setDepositForm({ ...depositForm, amount: Number(event.target.value) })} /></label>
            <label>説明<input value={depositForm.description} onChange={(event) => setDepositForm({ ...depositForm, description: event.target.value })} placeholder="共通口座へ入金" /></label>
            <label>コメント<textarea value={depositForm.comment} onChange={(event) => setDepositForm({ ...depositForm, comment: event.target.value })} /></label>
            <div className="form-actions"><button type="button" onClick={() => setShowDepositForm(false)}>キャンセル</button><button className="primary-button" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return <article className={`metric-card ${tone || ''}`}><span>{label}</span><strong>{value}</strong></article>;
}

function CheckItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <div className={`check-item ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="empty-cell">{text}</td></tr>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button onClick={onClose} aria-label="閉じる">閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}
