import { z } from 'zod';
import { allowedEmail, authClient } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = z.object({ email: z.string().trim().email().max(254), token: z.string().regex(/^\d{6,10}$/), type: z.enum(['email', 'invite']).default('email') }).strict().parse(await readJson(request));
    if (!allowedEmail(input.email)) throw new ApiError(401, 'コードを確認してください。');
    const client = await authClient();
    const { data, error } = await client.auth.verifyOtp(input);
    if (error || !data.user || data.user.is_anonymous) throw new ApiError(401, 'コードが正しくないか、有効期限が切れています。');
    try { await withUserDb(data.user.id, async () => true); }
    catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    return json({ signedIn: true });
  } catch (error) { return apiError(error); }
}
