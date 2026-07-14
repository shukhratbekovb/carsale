'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFavorites } from '@/hooks/use-favorites';
import { schedulePriceDropDemo } from '@/lib/mock/notifications';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  listingId: string;
  // Нужен только для demo-уведомления о снижении цены — не обязателен, если
  // где-то листинг ещё не готов передать title (например, в тестах).
  listingTitle?: string;
  className?: string;
}

// Оверлей поверх фото карточки — интерактивная кнопка, поэтому в ListingCard/
// ListingRow вынесена за пределы <Link> тем же приёмом, что MileageFlag
// (невалидный HTML — интерактивный элемент внутрь <a>).
export function FavoriteButton({ listingId, listingTitle, className }: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const tNotifications = useTranslations('notifications');
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(listingId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t('remove') : t('add')}
      onClick={(event) => {
        event.preventDefault();
        const wasFavorite = active;
        toggleFavorite(listingId);
        // Demo-триггер FR-11 (снижение цены на избранное) — только при
        // добавлении, не при снятии, и только если есть что показать в тексте.
        if (!wasFavorite && listingTitle) {
          schedulePriceDropDemo(
            tNotifications('priceDropTitle'),
            tNotifications('priceDropBody', { listingTitle }),
            `/catalog/${listingId}`
          );
        }
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-background/90 p-1.5 shadow-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <Heart
        className={cn('h-4 w-4', active ? 'fill-destructive text-destructive' : 'text-muted-foreground')}
        aria-hidden="true"
      />
    </button>
  );
}
