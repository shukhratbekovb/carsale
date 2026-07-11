import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { OtpForm } from '@/components/auth/otp-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Ввод OTP с таймером/ретраем/блокировкой (FR-01, UC-03). OtpForm читает
// phone/return из query сама через useSearchParams — оборачиваем в Suspense
// по тому же паттерну, что и CatalogFilters в app/[locale]/catalog/page.tsx.
export default function OtpPage() {
  const t = useTranslations('auth');

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('otpTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40" />}>
            <OtpForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
