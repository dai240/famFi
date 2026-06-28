import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// 支出の詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const prisma = getPrisma();
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        paidByPerson: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: '支出が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error('支出詳細取得エラー:', error);
    return NextResponse.json(
      { error: '支出の詳細取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 支出を更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
      comment
    } = body;

    // バリデーション
    if (!description || !amount || !category || !date || !paidBy) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    // 支出を更新
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        description,
        amount: parseInt(amount),
        category,
        subcategory: subcategory || category,
        date,
        paidBy,
        paymentMethod: paymentMethod || '現金',
        beneficiaries: beneficiaries || [],
        comment: comment || null
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

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error('支出更新エラー:', error);
    return NextResponse.json(
      { error: '支出の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 支出を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const prisma = getPrisma();
    // 支出を削除
    await prisma.expense.delete({
      where: { id }
    });

    return NextResponse.json({ message: '支出が削除されました' });
  } catch (error) {
    console.error('支出削除エラー:', error);
    return NextResponse.json(
      { error: '支出の削除に失敗しました' },
      { status: 500 }
    );
  }
}
