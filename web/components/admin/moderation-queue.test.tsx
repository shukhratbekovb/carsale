import { render, screen } from '@/src/test/utils';
import { ModerationQueue } from './moderation-queue';
import { mockListings } from '@/lib/mock/listings';
import type { ModerationItem } from '@/types/admin';

// Тот же паттерн, что chat-thread-list.test.tsx: компонент ходит в
// lib/mock/admin через mockFetchModerationQueue — мокаем сам мок-модуль,
// чтобы управлять содержимым очереди (включая пустую — с реальным seed
// она пустой не бывает).
const admin = vi.hoisted(() => ({ mockFetchModerationQueue: vi.fn() }));

vi.mock('@/lib/mock/admin', () => ({
  mockFetchModerationQueue: admin.mockFetchModerationQueue,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

// Снапшот объявления переиспользуем из общих фикстур каталога —
// очереди важны только make/model/year/цена/город.
function makeItem(overrides: Partial<ModerationItem> = {}): ModerationItem {
  return {
    id: 'mod-1',
    listing: mockListings.find((listing) => listing.id === '1')!,
    fraudFlag: { type: 'DUPLICATE_PHOTOS', duplicateOfListingId: '2' },
    seller: {
      id: 'seller-1',
      name: 'Jasur Toshpulatov',
      registeredAt: '2026-07-01T09:00:00Z',
      verified: false,
      activeListings: 1,
      previousRejections: 0,
    },
    status: 'PENDING',
    flaggedAt: '2026-07-12T09:15:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  admin.mockFetchModerationQueue.mockReset();
});

test('renders a row per item with title, price, city, flag date and a detail link', async () => {
  admin.mockFetchModerationQueue.mockResolvedValue([
    makeItem(),
    makeItem({
      id: 'mod-2',
      listing: mockListings.find((listing) => listing.id === '2')!,
      fraudFlag: { type: 'PRICE_ANOMALY', deviationPercent: 45 },
      flaggedAt: '2026-07-13T07:05:00Z',
    }),
  ]);
  render(<ModerationQueue />);

  expect(await screen.findByText('Chevrolet Cobalt, 2019')).toBeInTheDocument();
  expect(screen.getByText('Chevrolet Malibu 2, 2018')).toBeInTheDocument();
  // Цена · город · дата флага — одной строкой под заголовком.
  expect(screen.getByText(/95 000 000 сум · Ташкент · Флаг от 12\.07\.2026/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Chevrolet Cobalt/ })).toHaveAttribute(
    'href',
    '/admin/moderation/mod-1'
  );
  expect(screen.getByRole('link', { name: /Chevrolet Malibu 2/ })).toHaveAttribute(
    'href',
    '/admin/moderation/mod-2'
  );
});

test('renders the fraud flag badges, including the percent for PRICE_ANOMALY', async () => {
  admin.mockFetchModerationQueue.mockResolvedValue([
    makeItem(),
    makeItem({
      id: 'mod-2',
      fraudFlag: { type: 'PRICE_ANOMALY', deviationPercent: 45 },
    }),
  ]);
  render(<ModerationQueue />);

  expect(await screen.findByText('Дубликат фото')).toBeInTheDocument();
  // Подпись PRICE_ANOMALY включает процент отклонения (U+2212 в словаре).
  expect(screen.getByText('Аномальная цена −45%')).toBeInTheDocument();
});

test('shows the moderation status badge per row', async () => {
  admin.mockFetchModerationQueue.mockResolvedValue([
    makeItem(),
    makeItem({
      id: 'mod-2',
      status: 'APPROVED',
      decision: { decidedAt: '2026-07-14T10:00:00Z' },
    }),
  ]);
  render(<ModerationQueue />);

  expect(await screen.findByText('Ожидает решения')).toBeInTheDocument();
  expect(screen.getByText('Опубликовано')).toBeInTheDocument();
});

test('shows the empty state when the queue has no items', async () => {
  admin.mockFetchModerationQueue.mockResolvedValue([]);
  render(<ModerationQueue />);

  expect(await screen.findByText('Очередь модерации пуста')).toBeInTheDocument();
  expect(screen.getByText('Новые фрод-флаги появятся здесь автоматически.')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
