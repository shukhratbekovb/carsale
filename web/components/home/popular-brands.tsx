import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// Марки, реально доминирующие на рынке UZ (UzAuto Motors/Chevrolet + основные импортные).
// Инициалы вместо логотипов — реальных лицензированных логотипов брендов нет.
const POPULAR_BRANDS = [
  'Chevrolet',
  'Daewoo',
  'Isuzu',
  'Toyota',
  'Hyundai',
  'Kia',
  'Nissan',
  'Lexus',
  'BMW',
  'Mercedes-Benz',
  'Mitsubishi',
  'Lada',
];

export function PopularBrands() {
  const t = useTranslations('home');

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('popularBrands')}</h2>
        <Link
          href="/catalog"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t('allListings')}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {POPULAR_BRANDS.map((brand) => (
          <Link
            key={brand}
            href={`/catalog?make=${encodeURIComponent(brand)}`}
            className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {brand.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-sm">{brand}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
