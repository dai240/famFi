import { LoginForm } from '@/components/expenses/LoginForm';
import { EnvironmentBanner } from '@/components/expenses/EnvironmentBanner';
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <><EnvironmentBanner preview={process.env.FAMFI_DB_SCHEMA==='famfi_preview'} /><LoginForm invitation={mode === 'invite'} ready={Boolean(process.env.FAMFI_ALLOWED_EMAIL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)} /></>;
}
