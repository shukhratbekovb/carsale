import { useTranslations } from 'next-intl';
import { PhoneForm } from '@/components/auth/phone-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LoginPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Вход по номеру телефона + SMS OTP (FR-01, UC-03). Логика/валидация — в
// lib/validation/auth.ts и lib/mock/otp.ts, эта страница только собирает layout.
export default function LoginPage({ searchParams }: LoginPageProps) {
  const t = useTranslations('auth');
  const returnTo = firstValue(searchParams.return);

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('loginTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PhoneForm returnTo={returnTo} />
        </CardContent>
      </Card>
    </main>
  );
}
