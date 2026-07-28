import { getTranslations } from 'next-intl/server';
import { ListingCard } from '@/components/domain/listing-card';
import { HeroSearch } from '@/components/home/hero-search';
import { PopularBrands } from '@/components/home/popular-brands';
import { Link } from '@/i18n/navigation';
import { type CatalogResult, fetchCatalog } from '@/lib/catalog/api';

// Главная — публичный SSR (§5). «Свежие объявления» и счётчик берём из реального
// каталога Core (сортировка по дате по умолчанию); при недоступности Core секция
// свежих просто пустеет, hero/бренды остаются.
export default async function Home() {
  const t = await getTranslations('home');

  let data: CatalogResult | null = null;
  try {
    data = await fetchCatalog({ pageSize: '8' });
  } catch {
    data = null;
  }
  const fresh = data?.items ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        {data && (
          <p className="mt-2 text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t('statsCount', { count: data.total })}
            </span>{' '}
            {t('statsSuffix')}
          </p>
        )}
        <div className="mt-6 text-left">
          <HeroSearch />
        </div>
      </section>

      <PopularBrands />

      {fresh.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{t('freshListings')}</h2>
            <Link href="/catalog" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fresh.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
