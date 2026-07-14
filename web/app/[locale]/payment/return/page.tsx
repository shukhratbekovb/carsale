import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { PaymentResult } from '@/components/payment/payment-result';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Return-страница платёжного redirect-flow (frontend-plan.md §5,
// `/payment/return`). PaymentResult читает outcome/gateway/listingId/amount/
// failed из query сама — оборачиваем в Suspense тем же приёмом, что GatewaySelect.
export default function PaymentReturnPage() {
  const t = useTranslations('payment');

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('pageTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40" />}>
            <PaymentResult />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
