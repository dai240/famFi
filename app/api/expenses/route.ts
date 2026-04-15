import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';
import type { ExpenseSource, Payer } from '@/lib/ledger/types';

const repositories = createPrismaRepositories();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const payer = (searchParams.get('payer') || undefined) as Payer | undefined;
  const source = (searchParams.get('source') || undefined) as ExpenseSource | undefined;
  const expenses = await repositories.expenses.list({ month, categoryId, payer, source });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const expense = await repositories.expenses.create(await request.json());
  return NextResponse.json(expense, { status: 201 });
}
