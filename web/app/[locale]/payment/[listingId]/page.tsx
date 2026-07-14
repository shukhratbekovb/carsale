import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GatewaySelect } from '@/components/payment/gateway-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VEHICLE_REPORT_PRICE_UZS } from '@/lib/mock/payment';
import { mockListings } from '@/lib/mock/listings';

interface PaymentPageProps {
  params: { listingId: string };
}

// Экран выбора шлюза (FE-6, FR-10/UC-11). CSR per frontend-plan.md §5
// (`/payment/[listingId]` — «redirect на шлюз», нет SEO-ценности). GatewaySelect
// читает уже неудачные попытки из query сама через useSearchParams — оборачиваем
// в Suspense тем же приёмом, что и OtpForm в app/[locale]/auth/otp/page.tsx.
export default function PaymentPage({ params }: PaymentPageProps) {
  const t = useTranslations('payment');
  const listing = mockListings.find((item) => item.id === params.listingId);
  if (!listing) notFound();

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('pageTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40" />}>
            <GatewaySelect listingId={listing.id} amountUzs={VEHICLE_REPORT_PRICE_UZS} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
