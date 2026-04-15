import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(await repositories.categories.deactivate(params.id));
}
