import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@/src/test/utils';
import { ModerationQueue } from '@/components/admin/moderation-queue';
import { UsersTable } from '@/components/admin/users-table';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { ChatWindow } from '@/components/chat/chat-window';
import { ListingCard } from '@/components/domain/listing-card';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { NotificationBell } from '@/components/notifications/notification-bell';
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

vi.mock('@/lib/mock/notifications', () => ({
  mockFetchNotifications: () =>
    Promise.resolve([
      {
        id: 'n1',
        type: 'NEW_MESSAGE',
        title: 'Новое сообщение',
        message: 'Baxtiyor: Да, ещё в продаже',
        link: '/chat/thread-1',
        isRead: false,
        createdAt: '2026-07-14T10:00:00Z',
      },
      {
        id: 'n2',
        type: 'LISTING_STATUS',
        title: 'Статус объявления',
        message: '«Chevrolet Cobalt, 2019» отправлено на модерацию',
        isRead: true,
        createdAt: '2026-07-14T09:00:00Z',
      },
    ]),
  subscribeToNotifications: () => () => {},
  markNotificationRead: () => {},
  markAllNotificationsRead: () => {},
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

test('NotificationBell (FE-7, открытая панель с непрочитанными) has no axe violations', async () => {
  const user = userEvent.setup();
  const { container } = render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: /непрочитанн/ }));
  await screen.findByText('Baxtiyor: Да, ещё в продаже');

  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('ModerationQueue (FE-8, очередь с фрод-флагами) has no axe violations', async () => {
  // Реальный мок-модуль (lib/mock/admin.ts): seed всегда непустой —
  // ждём отрисовки первой строки очереди, чтобы не гонять axe по «Загружаем...».
  const { container } = render(<ModerationQueue />);
  await screen.findByText('Chevrolet Cobalt, 2019');

  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
});

test('UsersTable (FE-8, таблица пользователей с действиями) has no axe violations', async () => {
  const { container } = render(<UsersTable />);
  await screen.findByText('Baxtiyor Alimov');

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
