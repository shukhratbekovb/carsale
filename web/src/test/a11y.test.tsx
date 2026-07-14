import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@/src/test/utils';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { ChatWindow } from '@/components/chat/chat-window';
import { ListingCard } from '@/components/domain/listing-card';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { GatewaySelect } from '@/components/payment/gateway-select';
import { VehicleDetailsStep } from '@/components/sell/vehicle-details-step';
import { mockListings } from '@/lib/mock/listings';
import { createInitialDraftState } from '@/lib/sell/wizard-flow';

expect.extend(matchers);

// a11y-смоук ключевых компонентов (WCAG 2.1 AA — обязательный таргет, решение
// 2026-07-05). Это дешёвый гейт на грубые ошибки (label/role/aria); полный
// axe-аудит живых страниц — отдельный CI-шаг (frontend-plan.md §13.6, FE-10).
//
// color-contrast выключен: jsdom не считает каскад/CSS-переменные токенов,
// правило даёт ложные результаты вне реального браузера.
const AXE_OPTIONS = {
  rules: { 'color-contrast': { enabled: false } },
};

// Компоненты с навигацией: роутер/Link мокаются так же, как в юнит-тестах форм.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

test('Header has no axe violations', async () => {
  const { container } = render(<Header />);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('Footer has no axe violations', async () => {
  const { container } = render(<Footer />);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('ListingCard (все ML-бейджи) has no axe violations', async () => {
  const flagged = mockListings.find((listing) => listing.id === '4')!;
  const { container } = render(<ListingCard listing={flagged} />);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('CatalogFilters has no axe violations', async () => {
  const { container } = render(<CatalogFilters />);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('VehicleDetailsStep (самая тяжёлая форма) has no axe violations', async () => {
  const { container } = render(
    <VehicleDetailsStep draft={createInitialDraftState().draft.vehicle} onComplete={() => {}} />
  );
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('GatewaySelect (FE-6 экран выбора шлюза) has no axe violations', async () => {
  const { container } = render(<GatewaySelect listingId="1" amountUzs={45_000} />);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('ChatWindow (FE-5, загруженный тред с историей) has no axe violations', async () => {
  // Реальный мок-модуль (lib/mock/chat.ts), не vi.mock: 'thread-1' засеян
  // с историей сообщений — ждём, пока асинхронная загрузка отрисует их,
  // прежде чем гонять axe на пустом/загрузочном состоянии.
  const { container } = render(<ChatWindow threadId="thread-1" />);
  await waitFor(() => expect(screen.getByText('Baxtiyor')).toBeInTheDocument());

  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});
