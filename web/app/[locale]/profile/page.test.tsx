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
  // 3 переключателя типов уведомлений (FE-7) + «Маркетинговые уведомления»
  // из секции согласий (FE-9).
  expect(screen.getAllByRole('switch')).toHaveLength(4);
});

test('renders the FE-9 consents and GDPR sections', () => {
  render(<ProfilePage />);

  // Секция «Согласия»: без сохранённых согласий — статус «ещё не давалось».
  expect(screen.getByRole('heading', { name: 'Согласия' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Маркетинговые уведомления' })).toBeInTheDocument();

  // Секция «Мои данные»: экспорт и удаление аккаунта (NFR-20/21).
  expect(screen.getByRole('heading', { name: 'Мои данные' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Скачать мои данные' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Удалить аккаунт' })).toBeInTheDocument();
});
