import { cn } from '@/lib/utils';
import type { DealRatingLabel } from '@/types/listing';

// PRD §5.3: цветовой индикатор + текстовая метка, без голой иконки без пояснения.
const LABELS: Record<DealRatingLabel, string> = {
  GREAT_DEAL: 'Отличная сделка',
  FAIR_PRICE: 'Честная цена',
  OVERPRICED: 'Завышенная цена',
  UNAVAILABLE: 'Оценка недоступна',
};

const STYLES: Record<DealRatingLabel, string> = {
  GREAT_DEAL: 'bg-deal-great text-deal-great-foreground',
  FAIR_PRICE: 'bg-deal-fair text-deal-fair-foreground',
  OVERPRICED: 'bg-deal-overpriced text-deal-overpriced-foreground',
  UNAVAILABLE: 'bg-muted text-muted-foreground',
};

export function DealRatingBadge({ label }: { label: DealRatingLabel }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STYLES[label]
      )}
    >
      {LABELS[label]}
    </span>
  );
}
