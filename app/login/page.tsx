import { LoginForm } from '@/components/expenses/LoginForm';
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <LoginForm invitation={mode === 'invite'} ready={Boolean(process.env.FAMFI_ALLOWED_EMAIL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)} />;
}
