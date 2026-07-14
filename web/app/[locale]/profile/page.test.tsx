import { render, screen } from '@/src/test/utils';
import ProfilePage from './page';

// NotificationPreferences -> useNotificationPreferences -> useLocalStorage
// touches real window.localStorage; clear it around the test like the other
// localStorage-backed page tests (e.g. app/[locale]/favorites/page.test.tsx).
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('renders the page title and the notification preferences widget', () => {
  render(<ProfilePage />);

  expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument();
  expect(screen.getAllByRole('switch')).toHaveLength(3);
});
