'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { formatUzs } from '@/lib/format';
import { mockCreatePayment } from '@/lib/mock/payment';
import { bothGatewaysFailed, encodeFailedGateways, otherGateway, parseFailedGateways } from '@/lib/payment/gateway';
import { PAYMENT_GATEWAY_VALUES, type PaymentGateway } from '@/types/payment';

// Return-страница (frontend-plan.md §5, `/payment/return`). Обрабатывает
// оба исхода UC-11: успех и отклонённый платёж — в последнем случае даёт
// fallback на второй шлюз (R-10) прямо отсюда одним кликом, без повторного
// прохождения экрана выбора.
export function PaymentResult() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const outcome = searchParams.get('outcome');
  const gatewayParam = searchParams.get('gateway');
  const listingId = searchParams.get('listingId');
  const amountParam = searchParams.get('amount');
  const priorFailed = parseFailedGateways(searchParams.get('failed'));

  const gateway: PaymentGateway | null = (PAYMENT_GATEWAY_VALUES as readonly string[]).includes(
    gatewayParam ?? ''
  )
    ? (gatewayParam as PaymentGateway)
    : null;
  const amountUzs = amountParam ? Number(amountParam) : NaN;
  const isValid =
    (outcome === 'success' || outcome === 'declined') && gateway && listingId && Number.isFinite(amountUzs);

  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!isValid) {
      router.replace('/catalog');
    }
  }, [isValid, router]);

  if (!isValid) {
    return null;
  }

  const gatewayLabel = t(gateway === 'click' ? 'gatewayClick' : 'gatewayPayme');

  if (outcome === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-lg font-semibold">{t('successTitle')}</p>
        <p className="text-sm font-medium">{formatUzs(amountUzs, locale)}</p>
        <p className="text-sm text-muted-foreground">{t('successMessage')}</p>
        <Link
          href={`/catalog/${listingId}`}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('backToListing')}
        </Link>
      </div>
    );
  }

  const newFailed = [...priorFailed, gateway];

  if (bothGatewaysFailed(newFailed)) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-lg font-semibold">{t('bothFailedTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('bothFailedMessage')}</p>
        <Link
          href="/catalog"
          className="mt-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t('backToCatalog')}
        </Link>
      </div>
    );
  }

  async function retryWith(targetGateway: PaymentGateway) {
    setRetrying(true);
    try {
      const { paymentUrl } = await mockCreatePayment({
        listingId: listingId!,
        amountUzs,
        gateway: targetGateway,
      });
      router.push(`${paymentUrl}&failed=${encodeFailedGateways(newFailed)}`);
    } catch {
      setRetrying(false);
    }
  }

  const fallbackGateway = otherGateway(gateway);
  const fallbackLabel = t(fallbackGateway === 'click' ? 'gatewayClick' : 'gatewayPayme');

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className="text-lg font-semibold text-destructive">{t('declinedTitle')}</p>
      <p className="text-sm text-muted-foreground">{t('declinedMessage', { gateway: gatewayLabel })}</p>
      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={retrying}
          onClick={() => retryWith(gateway)}
          className="flex-1"
        >
          {t('retrySameGateway', { gateway: gatewayLabel })}
        </Button>
        <Button type="button" disabled={retrying} onClick={() => retryWith(fallbackGateway)} className="flex-1">
          {t('tryOtherGateway', { gateway: fallbackLabel })}
        </Button>
      </div>
    </div>
  );
}
