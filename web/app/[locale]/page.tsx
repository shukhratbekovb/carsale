import { useTranslations } from 'next-intl';
import { ListingCard } from '@/components/domain/listing-card';
import { HeroSearch } from '@/components/home/hero-search';
import { PopularBrands } from '@/components/home/popular-brands';
import { Link } from '@/i18n/navigation';
import { mockListings } from '@/lib/mock/listings';

export default function Home() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">
          {/* Мок-статистика — реальный агрегат придёт вместе с Core API */}
          <span className="font-semibold text-foreground">{t('statsCount', { count: 2483 })}</span>{' '}
          {t('statsSuffix')}
        </p>
        <div className="mt-6 text-left">
          <HeroSearch />
        </div>
      </section>

      <PopularBrands />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('freshListings')}</h2>
          <Link href="/catalog" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {t('viewAll')}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mockListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>
    </main>
  );
}
