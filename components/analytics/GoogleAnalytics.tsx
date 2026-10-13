'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { recordAnalyticsPage } from '@/lib/analytics';

export function GoogleAnalytics({ measurementId, view, presentation }: {
  measurementId?: string;
  view: string;
  presentation: string;
}) {
  const [activeId, setActiveId] = useState<string>();
  useEffect(() => {
    if (recordAnalyticsPage(window, measurementId, view, presentation)) setActiveId(measurementId);
  }, [measurementId, view, presentation]);

  return activeId ? <Script id="famfi-google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${activeId}`} strategy="afterInteractive" /> : null;
}
