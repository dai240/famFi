import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// 支出一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month'); // YYYY-MM形式

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      );
    }

    let whereClause: any = { userId };

    // 月でフィルタリング
    if (month) {
      whereClause.date = {
        startsWith: month
      };
    }

    const prisma = getPrisma();
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        paidByPerson: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('支出一覧取得エラー:', error);
    return NextResponse.json(
      { error: '支出一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 新規支出を作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      description,
      amount,
      category,
      subcategory,
      date,
      paidBy,
      paymentMethod,
      beneficiaries,
      comment,
      userId
    } = body;

    // バリデーション
    if (!description || !amount || !category || !date || !paidBy || !userId) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    // 支出を作成
    const expense = await prisma.expense.create({
      data: {
        description,
        amount: parseInt(amount),
        category,
        subcategory: subcategory || category,
        date,
        paidBy,
        paymentMethod: paymentMethod || '現金',
        beneficiaries: beneficiaries || [],
        comment: comment || null,
        userId
      },
      include: {
        paidByPerson: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('支出作成エラー:', error);
    return NextResponse.json(
      { error: '支出の作成に失敗しました' },
      { status: 500 }
    );
  }
}
