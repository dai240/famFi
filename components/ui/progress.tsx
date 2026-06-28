'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
}

const Progress = React.forwardRef<
  HTMLDivElement,
  ProgressProps
>(({ className, value = 0, max = 100, ...props }, ref) => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value ?? 0) ? value ?? 0 : 0;
  const normalizedValue = Math.min(Math.max(safeValue, 0), safeMax);
  const progress = (normalizedValue / safeMax) * 100;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={normalizedValue}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - progress}%)` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
