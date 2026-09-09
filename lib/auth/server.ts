import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApiError } from '@/lib/api';

// Route handlers only: they can refresh the session and write HttpOnly cookies.
export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiError(503, 'ログインの接続設定を準備中です。');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { name: 'famfi-auth', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { values.forEach(({ name, value, options }) => jar.set(name, value, options)); },
    },
  });
}
export async function requireUser() {
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous) throw new ApiError(401, 'ログインしてください。');
  return user;
}
export function allowedEmail(email: string) {
  const allowed = process.env.FAMFI_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed) throw new ApiError(503, '利用アカウントを準備中です。');
  return email.trim().toLowerCase() === allowed;
}
