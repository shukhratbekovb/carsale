'use client';

import { useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Клавиатурно доступный disclosure, не только hover (frontend-plan.md §6).
export function MileageFlag({ reason }: { reason?: string }) {
  const t = useTranslations('listing');
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('mileageFlag')}
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-10 mt-1 w-56 rounded-md border bg-background p-2 text-xs text-foreground shadow-md"
        >
          {reason ?? t('mileageFlagReason')}
        </div>
      )}
    </div>
  );
}
