import { render, screen } from '@/src/test/utils';
import MyListingsPage from './page';

// Нет реальной сессии/JWT (нет Core API — см. HANDOFF.md) — страница честно
// показывает auth-гейт вместо подделки чужих объявлений под мок-данные.
test('renders the login gate with a return link back to /my-listings', () => {
  render(<MyListingsPage />);

  expect(screen.getByRole('heading', { name: 'Мои объявления' })).toBeInTheDocument();
  expect(screen.getByText('Войдите, чтобы увидеть свои объявления')).toBeInTheDocument();

  // Тестовый провайдер даёт locale="ru" (не дефолтная) — i18n-Link добавляет префикс.
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute(
    'href',
    '/ru/auth/login?return=/my-listings'
  );
});

test('offers a shortcut to create a listing without logging in first', () => {
  render(<MyListingsPage />);

  expect(screen.getByRole('link', { name: 'Разместить объявление' })).toHaveAttribute(
    'href',
    '/ru/sell/new'
  );
});
