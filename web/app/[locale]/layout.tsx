import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { ToastHost } from '@/components/notifications/toast-host';
import { routing } from '@/i18n/routing';
import '../globals.css';

// latin-подмножество Inter включает U+02BB/U+02BC (oʻ, gʻ, eʼlon) — глифы
// узбекской латиницы покрыты, отдельный шрифт не нужен (риск FE-R-3).
// cyrillic обязателен для RU-локали: без него весь русский текст падал в
// системный fallback (Segoe UI на Windows, ЗАМЕТНО более широкий DejaVu Sans
// на Linux) — типографика RU расходилась с UZ, а вьюпорт-тесты NFR-24
// проходили локально и падали на CI с переполнением ровно в разницу метрик.
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, 'params'>): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' });
  return {
    title: 'Carsale',
    description: t('description'),
  };
}

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  if (!hasLocale(routing.locales, params.locale)) {
    notFound();
  }
  setRequestLocale(params.locale);

  return (
    <html lang={params.locale}>
      <body className={`${inter.variable} flex min-h-screen flex-col font-sans antialiased`}>
        <NextIntlClientProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
          <ToastHost />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
