export const ANALYTICS_ORIGIN = 'https://famfi-nu.vercel.app';

const screens: Record<string, { path: string; title: string }> = {
  expenses: { path: '/expenses', title: 'famFi | 支出' },
  calendar: { path: '/expenses/calendar', title: 'famFi | カレンダー' },
  cash: { path: '/expenses/cash', title: 'famFi | 入出金' },
  finance: { path: '/expenses/summary', title: 'famFi | 家計サマリー' },
  settlements: { path: '/expenses/settlements', title: 'famFi | 立替・精算' },
  recurring: { path: '/expenses/recurring', title: 'famFi | 予定・定期' },
  notes: { path: '/expenses/notes', title: 'famFi | 共有メモ' },
  household: { path: '/expenses/household', title: 'famFi | 家計の共有' },
  history: { path: '/expenses/history', title: 'famFi | 変更履歴' },
};

export function analyticsMeasurementId(environment: {
  VERCEL_ENV?: string;
  FAMFI_DB_SCHEMA?: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
}) {
  const id = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return environment.VERCEL_ENV === 'production'
    && environment.FAMFI_DB_SCHEMA !== 'famfi_preview'
    && id && /^G-[A-Z0-9]+$/.test(id) ? id : undefined;
}

export function analyticsPage(view: string, presentation = 'list') {
  const key = view === 'expenses' && presentation === 'calendar' ? 'calendar' : view;
  if (!Object.hasOwn(screens, key)) return null;
  const screen = screens[key];
  return {
    page_location: ANALYTICS_ORIGIN + screen.path,
    page_title: screen.title,
    page_referrer: '',
  };
}

type Gtag = (...args: unknown[]) => void;
export type AnalyticsRuntime = {
  location: { origin: string; pathname: string };
  navigator: { doNotTrack?: string | null; globalPrivacyControl?: boolean };
  dataLayer?: unknown[];
  gtag?: Gtag;
  famfiAnalytics?: { measurementId: string; lastLocation: string };
};

// Accept only fixed screen keys, never records, DOM text, URLs or user identifiers.
export function recordAnalyticsPage(runtime: AnalyticsRuntime, measurementId: string | undefined, view: string, presentation = 'list') {
  const page = analyticsPage(view, presentation);
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId) || !page
    || runtime.location.origin !== ANALYTICS_ORIGIN || runtime.location.pathname !== '/expenses'
    || runtime.navigator.doNotTrack === '1' || runtime.navigator.globalPrivacyControl === true) return false;

  if (runtime.famfiAnalytics && runtime.famfiAnalytics.measurementId !== measurementId) return false;
  if (!runtime.famfiAnalytics) {
    runtime.dataLayer ??= [];
    runtime.gtag = function () { runtime.dataLayer!.push(arguments); };
    runtime.gtag('consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    runtime.gtag('set', page);
    runtime.gtag('js', new Date());
    runtime.gtag('config', measurementId, {
      ...page,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: 'none',
      cookie_flags: 'SameSite=Lax;Secure',
    });
    runtime.famfiAnalytics = { measurementId, lastLocation: '' };
  }
  if (runtime.famfiAnalytics.lastLocation !== page.page_location) {
    runtime.gtag!('set', page);
    runtime.gtag!('event', 'page_view', { ...page, send_to: measurementId });
    runtime.famfiAnalytics.lastLocation = page.page_location;
  }
  return true;
}
