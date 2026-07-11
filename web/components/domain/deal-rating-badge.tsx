import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DealRatingLabel } from '@/types/listing';

const STYLES: Record<DealRatingLabel, string> = {
  GREAT_DEAL: 'bg-deal-great text-deal-great-foreground',
  FAIR_PRICE: 'bg-deal-fair text-deal-fair-foreground',
  OVERPRICED: 'bg-deal-overpriced text-deal-overpriced-foreground',
  UNAVAILABLE: 'bg-muted text-muted-foreground',
};

// PRD §5.3: цветовой индикатор + текстовая метка, без голой иконки без пояснения.
export function DealRatingBadge({ label }: { label: DealRatingLabel }) {
  const t = useTranslations('listing');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STYLES[label]
      )}
    >
      {t(`dealRating.${label}`)}
    </span>
  );
}
