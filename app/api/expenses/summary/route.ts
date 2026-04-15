import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });
  return NextResponse.json(await repositories.expenses.summary(month));
}
