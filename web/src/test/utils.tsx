import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ruMessages from '@/messages/ru.json';

// Central place to add app-wide providers (i18n, theme, query client) as they
// land, so component tests don't each hand-roll their own wrapper.
// Tests run with the RU dictionary: assertions are written against the same
// Russian strings the UI shipped with before i18n landed.
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="ru" messages={ruMessages} timeZone="Asia/Tashkent">
      {children}
    </NextIntlClientProvider>
  );
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
