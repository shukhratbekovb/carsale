import { Car } from 'lucide-react';
import { cn } from '@/lib/utils';

// Временная заглушка вместо фото — реальные фото и CDN появятся вместе с Core API/ML-сервисом (FE-4).
export function ListingPhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center bg-muted', className)}>
      <Car className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
