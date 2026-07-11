'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { Button } from '@/components/ui/button';
import { mockEstimatePrice, type PriceEstimateInput, type PriceEstimateResult } from '@/lib/mock/price-estimate';
import type { PriceEstimateState } from '@/types/sell';

interface PriceEstimateWidgetProps {
  priceEstimate: PriceEstimateState;
  vehicle: PriceEstimateInput;
  onLoading: () => void;
  onLoaded: (result: PriceEstimateResult) => void;
  onFailed: (error?: string) => void;
  onComplete: () => void;
}

export function PriceEstimateWidget({
  priceEstimate,
  vehicle,
  onLoading,
  onLoaded,
  onFailed,
  onComplete,
}: PriceEstimateWidgetProps) {
  const t = useTranslations('sell');

  // Автозапрос оценки при первом входе на шаг — характеристики авто уже известны
  // из предыдущего шага, ждать явного клика продавца незачем. requestedRef защищает
  // от повторного запроса из-за Strict Mode двойного рендера/повторных рендеров шага.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current || priceEstimate.status !== 'IDLE') return;
    requestedRef.current = true;
    requestEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestEstimate() {
    onLoading();
    mockEstimatePrice(vehicle)
      .then((result) => onLoaded(result))
      .catch(() => onFailed('PRICE_ESTIMATE_FAILED'));
  }

  function handleRetry() {
    requestedRef.current = true;
    requestEstimate();
  }

  return (
    <div className="flex flex-col gap-4">
      {priceEstimate.status === 'IDLE' && (
        <p className="text-sm text-muted-foreground">{t('priceEstimateLoading')}</p>
      )}

      {priceEstimate.status === 'LOADING' && (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('priceEstimateLoading')}</p>
        </div>
      )}

      {priceEstimate.status === 'LOADED' && (
        <div className="flex flex-col gap-2">
          <DealRatingBadge label={priceEstimate.label} />
          {priceEstimate.recommendedMin != null && priceEstimate.recommendedMax != null && (
            <p className="text-sm text-muted-foreground">
              {t('priceEstimateRecommended', {
                min: priceEstimate.recommendedMin,
                max: priceEstimate.recommendedMax,
              })}
            </p>
          )}
        </div>
      )}

      {priceEstimate.status === 'FAILED' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{t('priceEstimateFailed')}</p>
          <Button type="button" variant="outline" onClick={handleRetry} className="self-start">
            {t('priceEstimateRetry')}
          </Button>
        </div>
      )}

      <Button
        type="button"
        onClick={onComplete}
        disabled={priceEstimate.status === 'LOADING'}
        className="self-end"
      >
        {t('next')}
      </Button>
    </div>
  );
}
