import { NextResponse } from 'next/server';
import { createPrismaRepositories } from '@/lib/ledger/prisma-repositories';

const repositories = createPrismaRepositories();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  return NextResponse.json(await repositories.categories.list(includeInactive));
}

export async function POST(request: Request) {
  const category = await repositories.categories.upsert(await request.json());
  return NextResponse.json(category);
}
