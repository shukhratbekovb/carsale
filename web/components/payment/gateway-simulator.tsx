'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { formatUzs } from '@/lib/format';
import { PAYMENT_GATEWAY_VALUES, type PaymentGateway } from '@/types/payment';

// Страница-имитация чекаута шлюза (redirect-flow — frontend-plan.md §5,
// `/payment/gateway-sim`): в реальном сервисе здесь домен click.uz/payme.uz
// и форма ввода карты (PCI DSS, вне периметра Carsale). Кнопки «Оплатить»/
// «Отменить» имитируют решение банка-эмитента — воспроизводимо для живой
// проверки и тестов, в отличие от случайного сбоя.
export function GatewaySimulator() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tx = searchParams.get('tx');
  const gatewayParam = searchParams.get('gateway');
  const listingId = searchParams.get('listingId');
  const amountParam = searchParams.get('amount');
  const failed = searchParams.get('failed');

  const gateway: PaymentGateway | null = (PAYMENT_GATEWAY_VALUES as readonly string[]).includes(
    gatewayParam ?? ''
  )
    ? (gatewayParam as PaymentGateway)
    : null;
  const amountUzs = amountParam ? Number(amountParam) : NaN;
  const isValid = tx && gateway && listingId && Number.isFinite(amountUzs);

  // Прямой заход без валидной сессии платежа (например, обновление страницы
  // после того, как флоу уже завершился) — некуда показывать чекаут, уводим
  // на каталог. Тот же приём, что OtpForm использует для отсутствующего phone.
  useEffect(() => {
    if (!isValid) {
      router.replace('/catalog');
    }
  }, [isValid, router]);

  if (!isValid) {
    return null;
  }

  const gatewayLabel = t(gateway === 'click' ? 'gatewayClick' : 'gatewayPayme');

  function finish(outcome: 'success' | 'declined') {
    const params = new URLSearchParams({
      tx: tx!,
      gateway: gateway!,
      listingId: listingId!,
      amount: String(amountUzs),
      outcome,
    });
    if (failed) params.set('failed', failed);
    router.push(`/payment/return?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-dashed p-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('simTitle', { gateway: gatewayLabel })}
      </p>
      <p className="text-sm text-muted-foreground">{t('simNote')}</p>

      <div className="flex items-center justify-between rounded-md bg-muted p-3">
        <span className="text-sm">{t('simAmountLabel')}</span>
        <span className="font-semibold">{formatUzs(amountUzs, locale)}</span>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={() => finish('success')} className="flex-1">
          {t('simPay', { amount: formatUzs(amountUzs, locale) })}
        </Button>
        <Button type="button" variant="outline" onClick={() => finish('declined')} className="flex-1">
          {t('simCancel')}
        </Button>
      </div>
    </div>
  );
}
