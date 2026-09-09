import { authClient } from '@/lib/auth/server';
import { ApiError, apiError, assertSameOrigin, json } from '@/lib/api';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const client = await authClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new ApiError(503, 'ログアウトできませんでした。もう一度お試しください。');
    return json({ signedOut: true });
  } catch (error) { return apiError(error); }
}
