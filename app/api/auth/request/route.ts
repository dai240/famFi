import { z } from 'zod';
import { allowedEmail, authClient } from '@/lib/auth/server';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email } = z.object({ email: z.string().trim().email().max(254) }).strict().parse(await readJson(request));
    // Do not disclose the allowlist. Supabase applies its own OTP delivery/verification rate limits.
    if (allowedEmail(email)) {
      const client = await authClient();
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw new ApiError(error.status === 429 ? 429 : 503,
        error.status === 429 ? '少し時間をおいてから再送してください。' : 'メールを送信できませんでした。時間をおいてお試しください。');
    }
    return json({ sent: true });
  } catch (error) { return apiError(error); }
}
