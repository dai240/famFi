import { LoginForm } from '@/components/expenses/LoginForm';
export const dynamic = 'force-dynamic';
export default function LoginPage() { return <LoginForm ready={Boolean(process.env.FAMFI_ALLOWED_EMAIL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)} />; }
