import { useTranslations } from 'next-intl';
import type { FraudFlag } from '@/types/admin';

// Тип фрод-флага (UC-15): у PRICE_ANOMALY подпись включает процент отклонения
// цены вниз. Контурный стиль отличает флаг от «сплошных» статус-бейджей;
// text-warning на светлой подложке — контраст ~6.5:1 (WCAG 2.1 AA).
export function FraudFlagBadge({ flag }: { flag: FraudFlag }) {
  const t = useTranslations('admin');

  const label =
    flag.type === 'PRICE_ANOMALY'
      ? t('fraudFlag.PRICE_ANOMALY', { percent: flag.deviationPercent })
      : t('fraudFlag.DUPLICATE_PHOTOS');

  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
      {label}
    </span>
  );
}
