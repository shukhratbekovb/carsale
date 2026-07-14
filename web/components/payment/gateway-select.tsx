'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { formatUzs } from '@/lib/format';
import { encodeFailedGateways, parseFailedGateways } from '@/lib/payment/gateway';
import { mockCreatePayment } from '@/lib/mock/payment';
import { cn } from '@/lib/utils';
import { PAYMENT_GATEWAY_VALUES, type PaymentGateway } from '@/types/payment';

interface GatewaySelectProps {
  listingId: string;
  amountUzs: number;
}

// Экран выбора шлюза (FE-6, UC-11 основной поток). Читает уже неудачные
// попытки из query (?failed=click,payme, см. lib/payment/gateway.ts) сама —
// тот же паттерн, что OtpForm использует для phone/return в /auth/otp.
export function GatewaySelect({ listingId, amountUzs }: GatewaySelectProps) {
  const t = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const failedGateways = parseFailedGateways(searchParams.get('failed'));

  const [creatingGateway, setCreatingGateway] = useState<PaymentGateway | null>(null);
  const [createErrorGateway, setCreateErrorGateway] = useState<PaymentGateway | null>(null);

  async function handleSelect(gateway: PaymentGateway) {
    setCreateErrorGateway(null);
    setCreatingGateway(gateway);
    try {
      const { paymentUrl } = await mockCreatePayment({ listingId, amountUzs, gateway });
      const failedQuery = encodeFailedGateways(failedGateways);
      router.push(failedQuery ? `${paymentUrl}&failed=${failedQuery}` : paymentUrl);
    } catch {
      setCreateErrorGateway(gateway);
      setCreatingGateway(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md bg-muted p-3">
        <span className="text-sm">{t('amountLabel')}</span>
        <span className="text-lg font-semibold">{formatUzs(amountUzs, locale)}</span>
      </div>

      <p className="text-sm font-medium">{t('chooseGateway')}</p>
      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_GATEWAY_VALUES.map((gateway) => {
          const label = t(gateway === 'click' ? 'gatewayClick' : 'gatewayPayme');
          const wasFailed = failedGateways.includes(gateway);
          const isCreating = creatingGateway === gateway;

          return (
            <button
              key={gateway}
              type="button"
              disabled={creatingGateway !== null}
              onClick={() => handleSelect(gateway)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-4 text-sm font-medium transition-colors',
                'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                wasFailed && 'border-amber-400'
              )}
            >
              <span>{label}</span>
              {isCreating && <span className="text-xs text-muted-foreground">{t('creating')}</span>}
              {wasFailed && !isCreating && (
                <span className="text-xs text-amber-600">{t('gatewayUnavailableHint')}</span>
              )}
            </button>
          );
        })}
      </div>

      {createErrorGateway && (
        <div className="rounded-md border border-destructive/50 p-3 text-sm">
          <p className="font-medium text-destructive">{t('createFailedTitle')}</p>
          <p className="text-muted-foreground">{t('createFailedMessage')}</p>
        </div>
      )}
    </div>
  );
}
