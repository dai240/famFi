import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// カテゴリ一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('カテゴリ一覧取得エラー:', error);
    return NextResponse.json(
      { error: 'カテゴリ一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 新規カテゴリを作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      color,
      subcategories,
      userId
    } = body;

    // バリデーション
    if (!name || !color || !userId) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    // カテゴリを作成
    const category = await prisma.category.create({
      data: {
        name,
        color,
        subcategories: subcategories || [],
        userId
      }
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('カテゴリ作成エラー:', error);
    return NextResponse.json(
      { error: 'カテゴリの作成に失敗しました' },
      { status: 500 }
    );
  }
}
