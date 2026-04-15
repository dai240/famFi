import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const deposits = month ? await repositories.deposits.listByMonth(month) : await repositories.deposits.list();
  return NextResponse.json(deposits);
}

export async function POST(request: Request) {
  const deposit = await repositories.deposits.create(await request.json());
  return NextResponse.json(deposit, { status: 201 });
}
