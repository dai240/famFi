import { ExpenseWorkspace } from '@/components/expenses/ExpenseWorkspace';
import { todayInJapan } from '@/lib/expenses';
import { EnvironmentBanner } from '@/components/expenses/EnvironmentBanner';
import { analyticsMeasurementId } from '@/lib/analytics';
export const dynamic = 'force-dynamic';
export default function ExpensesPage() {
  const analyticsId = analyticsMeasurementId({
    VERCEL_ENV: process.env.VERCEL_ENV,
    FAMFI_DB_SCHEMA: process.env.FAMFI_DB_SCHEMA,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  });
  return <><EnvironmentBanner preview={process.env.FAMFI_DB_SCHEMA==='famfi_preview'} /><ExpenseWorkspace initialMonth={todayInJapan().slice(0, 7)} analyticsId={analyticsId} /></>;
}
