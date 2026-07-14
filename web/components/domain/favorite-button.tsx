'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFavorites } from '@/hooks/use-favorites';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  listingId: string;
  className?: string;
}

// Оверлей поверх фото карточки — интерактивная кнопка, поэтому в ListingCard/
// ListingRow вынесена за пределы <Link> тем же приёмом, что MileageFlag
// (невалидный HTML — интерактивный элемент внутрь <a>).
export function FavoriteButton({ listingId, className }: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(listingId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t('remove') : t('add')}
      onClick={(event) => {
        event.preventDefault();
        toggleFavorite(listingId);
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
