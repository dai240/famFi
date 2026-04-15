import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const expense = await repositories.expenses.update(params.id, await request.json());
  return NextResponse.json(expense);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await repositories.expenses.delete(params.id);
  return new NextResponse(null, { status: 204 });
}
