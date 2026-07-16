import { render, screen } from '@/src/test/utils';
import AdminAnalyticsPage from './page';
import { __resetAdminMocks, mockFetchAnalytics } from '@/lib/mock/admin';
import type { PlatformAnalytics } from '@/types/admin';

// Подписи плиток из admin.analytics.* (ru.json) — ключи совпадают
// с ключами PlatformAnalytics, порядок задаёт STAT_KEYS страницы.
const TILE_LABELS: Record<keyof PlatformAnalytics, string> = {
  totalListings: 'Всего объявлений',
  activeListings: 'Активных объявлений',
  pendingModeration: 'На модерации',
  rejectedListings: 'Отклонено',
  totalUsers: 'Всего пользователей',
  activeUsers30d: 'Активных за 30 дней (MAU)',
  newListings7d: 'Новых объявлений за 7 дней',
  newUsers7d: 'Новых пользователей за 7 дней',
};

beforeEach(() => {
  __resetAdminMocks();
});

test('renders the 8 stat tiles with the live numbers from mockFetchAnalytics', async () => {
  // Ожидаемые значения берём из того же живого мока, которым пользуется
  // страница — не хардкодим счётчики seed-данных.
  const analytics = await mockFetchAnalytics();
  render(<AdminAnalyticsPage />);

  expect(screen.getByRole('heading', { name: 'Аналитика платформы' })).toBeInTheDocument();
  expect(await screen.findByText('Всего объявлений')).toBeInTheDocument();

  // Плитка = <p>число</p> + <p>подпись</p>: сверяем число, стоящее
  // непосредственно над каждой из 8 подписей (точное совпадение,
  // toHaveTextContent матчит подстроку и пропустил бы «0» внутри «10»).
  for (const key of Object.keys(TILE_LABELS) as (keyof PlatformAnalytics)[]) {
    const label = screen.getByText(TILE_LABELS[key]);
    expect(label.previousElementSibling?.textContent).toBe(String(analytics[key]));
  }
});
