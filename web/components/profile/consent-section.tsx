'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateDdMmYyyy } from '@/lib/format';
import { readConsents, setMarketingConsent } from '@/lib/gdpr/consent';
import type { ConsentState } from '@/types/gdpr';

// Секция «Согласия» профиля (FE-9, ЗРУ-547): статус базового согласия на
// обработку ПД (принимается при регистрации, см. components/auth/phone-form.tsx)
// и отзыв/выдача маркетингового согласия в один клик (PRD 7.2).
export function ConsentSection() {
  const t = useTranslations('profile');

  // null = согласия ещё не прочитаны. readConsents() ходит в localStorage,
  // поэтому читаем ТОЛЬКО после монтирования (useEffect), а не в первом
  // рендере — иначе клиентский HTML разошёлся бы с серверным (hydration
  // mismatch: на сервере localStorage нет).
  const [consents, setConsents] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsents(readConsents());
  }, []);

  function handleMarketingChange(enabled: boolean) {
    // setMarketingConsent пишет в localStorage и возвращает новое состояние —
    // локальный state синхронизируется с персистентным без повторного чтения.
    setConsents(setMarketingConsent(enabled));
  }

  const marketingEnabled = consents?.marketing ?? false;

  return (
    <section aria-labelledby="profile-consents-heading" className="rounded-lg border p-4">
      <h2 id="profile-consents-heading" className="text-lg font-semibold">
        {t('consentsTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {consents?.acceptedAt
          ? t('personalDataAccepted', { date: formatDateDdMmYyyy(consents.acceptedAt) })
          : t('personalDataNotGiven')}
      </p>

      <div className="mt-4 flex items-center justify-between gap-4 border-t pt-3">
        <label htmlFor="consent-marketing" className="text-sm">
          {t('marketingConsentLabel')}
        </label>
        {/* Toggle — тот же switch-паттерн, что в notification-preferences.tsx.
            До монтирования выключен: состояние ещё не прочитано. */}
        <input
          id="consent-marketing"
          type="checkbox"
          role="switch"
          aria-checked={marketingEnabled}
          checked={marketingEnabled}
          disabled={consents === null}
          onChange={(event) => handleMarketingChange(event.target.checked)}
          className="h-5 w-9 shrink-0 appearance-none rounded-full bg-muted transition-colors checked:bg-primary relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-background before:transition-transform checked:before:translate-x-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </section>
  );
}
