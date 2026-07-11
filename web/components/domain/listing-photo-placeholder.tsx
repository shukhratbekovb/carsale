import { Car } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Временная заглушка вместо фото — реальные фото и CDN появятся вместе с Core API/ML-сервисом (FE-4).
// role="img" + aria-label вместо голого декоративного div: скринридер должен узнать,
// что здесь предполагается фото объявления, а не просто пропустить пустой блок.
export function ListingPhotoPlaceholder({ className }: { className?: string }) {
  const t = useTranslations('listing');

  return (
    <div
      role="img"
      aria-label={t('photoUnavailable')}
      className={cn('flex items-center justify-center bg-muted', className)}
    >
      <Car className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
