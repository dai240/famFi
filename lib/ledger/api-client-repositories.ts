'use client';

import type { CategoryRepository, DepositRepository, ExpenseRepository } from './repositories';
import type {
  Category,
  CategoryInput,
  Deposit,
  DepositInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  MonthlySummary,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export class ApiExpenseRepository implements ExpenseRepository {
  async list(filters?: Partial<ExpenseFilters>): Promise<Expense[]> {
    return request<Expense[]>(withQuery('/api/expenses', {
      month: filters?.month,
      categoryId: filters?.categoryId,
      payer: filters?.payer,
      source: filters?.source,
    }));
  }

  async listByMonth(month: string): Promise<Expense[]> {
    return this.list({ month });
  }

  async create(input: ExpenseInput): Promise<Expense> {
    return request<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(input) });
  }

  async update(id: string, input: ExpenseInput): Promise<Expense> {
    return request<Expense>(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  }

  async delete(id: string): Promise<void> {
    await request<void>(`/api/expenses/${id}`, { method: 'DELETE' });
  }

  async summary(month: string): Promise<MonthlySummary> {
    return request<MonthlySummary>(withQuery('/api/expenses/summary', { month }));
  }
}

export class ApiDepositRepository implements DepositRepository {
  async list(): Promise<Deposit[]> {
    return request<Deposit[]>('/api/deposits');
  }

  async listByMonth(month: string): Promise<Deposit[]> {
    return request<Deposit[]>(withQuery('/api/deposits', { month }));
  }

  async create(input: DepositInput): Promise<Deposit> {
    return request<Deposit>('/api/deposits', { method: 'POST', body: JSON.stringify(input) });
  }

  async update(id: string, input: DepositInput): Promise<Deposit> {
    return request<Deposit>(`/api/deposits/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  }

  async delete(id: string): Promise<void> {
    await request<void>(`/api/deposits/${id}`, { method: 'DELETE' });
  }
}

export class ApiCategoryRepository implements CategoryRepository {
  async list(includeInactive = false): Promise<Category[]> {
    return request<Category[]>(withQuery('/api/categories', { includeInactive: includeInactive ? 'true' : undefined }));
  }

  async upsert(input: CategoryInput): Promise<Category> {
    return request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) });
  }

  async deactivate(id: string): Promise<Category> {
    return request<Category>(`/api/categories/${id}`, { method: 'DELETE' });
  }

  async reorder(ids: string[]): Promise<Category[]> {
    return request<Category[]>('/api/categories/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
  }
}

export function createApiRepositories() {
  return {
    expenses: new ApiExpenseRepository(),
    deposits: new ApiDepositRepository(),
    categories: new ApiCategoryRepository(),
  };
}
