import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const deposit = await repositories.deposits.update(params.id, await request.json());
  return NextResponse.json(deposit);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await repositories.deposits.delete(params.id);
  return new NextResponse(null, { status: 204 });
}
