import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { routing } from '@/i18n/routing';
import '../globals.css';

// latin-подмножество Inter включает U+02BB/U+02BC (oʻ, gʻ, eʼlon) — глифы
// узбекской латиницы покрыты, отдельный шрифт не нужен (риск FE-R-3).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
