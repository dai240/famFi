import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}
export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError) return json({ error: '入力内容を確認してください。' }, 400);
  // Do not log database exceptions: they may contain connection details or user data.
  console.error('famFi request failed', { type: error instanceof Error ? error.name : 'UnknownError' });
  return json({ error: '処理に失敗しました。時間をおいてもう一度お試しください。' }, 503);
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN;
  if (!expected) throw new ApiError(503, '接続設定を準備中です。');
  if (origin !== new URL(expected).origin) throw new ApiError(403, 'この操作は許可されていません。');
}
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON形式が必要です。');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '入力内容がありません。');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) { await reader.cancel(); throw new ApiError(413, '入力が長すぎます。'); }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}
