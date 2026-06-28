import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// 家族・メンバー一覧を取得
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
    const people = await prisma.person.findMany({
      where: { userId },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(people);
  } catch (error) {
    console.error('家族・メンバー一覧取得エラー:', error);
    return NextResponse.json(
      { error: '家族・メンバー一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 新規家族・メンバーを作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      role,
      age,
      userId
    } = body;

    // バリデーション
    if (!name || !userId) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    // 家族・メンバーを作成
    const person = await prisma.person.create({
      data: {
        name,
        role: role || null,
        age: age ? parseInt(age) : null,
        userId
      }
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    console.error('家族・メンバー作成エラー:', error);
    return NextResponse.json(
      { error: '家族・メンバーの作成に失敗しました' },
      { status: 500 }
    );
  }
}
