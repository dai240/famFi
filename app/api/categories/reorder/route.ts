import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  return NextResponse.json(await repositories.categories.reorder(body.ids || []));
}
