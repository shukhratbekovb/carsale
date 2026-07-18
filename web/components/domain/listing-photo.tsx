import Image from 'next/image';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { cn } from '@/lib/utils';

interface ListingPhotoProps {
  // Опциональное поле Listing.photoUrl: объявление без фото — легальное
  // состояние, рендерим прежний плейсхолдер, а не пустой блок.
  photoUrl?: string;
  // Осмысленный alt («{make} {model}, {year}») — фото несёт содержание,
  // пустой alt здесь был бы a11y-регрессией.
  alt: string;
  // Обязателен при fill: без sizes next/image просит у браузера 100vw
  // и раздувает выбор из srcset. Значение зависит от раскладки вызывающего.
  sizes: string;
  // Только для LCP-кандидатов (hero детальной страницы, первая карточка грида).
  priority?: boolean;
  className?: string;
}

// Обложка объявления. Геометрию (aspect-ratio / фиксированные размеры) задаёт
// вызывающий через className — fill растягивает фото по контейнеру, object-cover
// сохраняет кадрирование без искажений.
export function ListingPhoto({ photoUrl, alt, sizes, priority = false, className }: ListingPhotoProps) {
  if (!photoUrl) {
    return <ListingPhotoPlaceholder className={className} />;
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={photoUrl}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
