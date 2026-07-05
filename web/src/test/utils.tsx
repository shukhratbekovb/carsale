import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';

// Central place to add app-wide providers (i18n, theme, query client) as they
// land, so component tests don't each hand-roll their own wrapper.
function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
