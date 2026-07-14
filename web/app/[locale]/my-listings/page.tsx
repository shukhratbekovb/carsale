import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

// Продавец, auth-walled dashboard (frontend-plan.md §5, /my-listings — P0,
// FR-05, UC-12). Реальной сессии/JWT ещё нет (нет Core API — см. HANDOFF.md
// п.11), поэтому у приложения нигде нет понятия «текущий продавец»: страница
// честно показывает auth-гейт вместо того, чтобы подделывать чужие объявления
// под мок-данные. Список объявлений продавца подключится вместе с сессией.
export default function MyListingsPage() {
  const t = useTranslations('myListings');

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('pageTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="font-semibold">{t('loginRequiredTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('loginRequiredMessage')}</p>
          </div>
          <Link
            href="/auth/login?return=/my-listings"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('login')}
          </Link>
          <Link
            href="/sell/new"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t('createListing')}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
