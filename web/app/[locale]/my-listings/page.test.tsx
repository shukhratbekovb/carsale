import { render, screen } from '@/src/test/utils';
import MyListingsPage from './page';

// Страница теперь session-aware (§5): RequireAuth редиректит гостя на логин,
// авторизованный видит кабинет-плейсхолдер. Мокаем сессию и локале-навигацию.
const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/my-listings' }));
const session = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading' }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth/session', () => ({
  useSession: () => ({ status: session.status }),
}));

beforeEach(() => {
  nav.replace.mockClear();
  session.status = 'authenticated';
});

test('authenticated: renders the dashboard placeholder + create link', () => {
  render(<MyListingsPage />);

  expect(screen.getByRole('heading', { name: 'Мои объявления' })).toBeInTheDocument();
  expect(screen.getByText('У вас пока нет объявлений')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Разместить объявление' })).toHaveAttribute('href', '/sell/new');
  expect(nav.replace).not.toHaveBeenCalled();
});

test('anonymous: redirects to login with a return to the current path and hides content', () => {
  session.status = 'anonymous';
  render(<MyListingsPage />);

  expect(nav.replace).toHaveBeenCalledWith('/auth/login?return=%2Fmy-listings');
  expect(screen.queryByRole('heading', { name: 'Мои объявления' })).not.toBeInTheDocument();
});

test('loading: shows neither content nor a redirect yet', () => {
  session.status = 'loading';
  render(<MyListingsPage />);

  expect(nav.replace).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Мои объявления' })).not.toBeInTheDocument();
});
