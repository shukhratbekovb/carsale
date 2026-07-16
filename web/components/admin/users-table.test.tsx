import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@/src/test/utils';
import { UsersTable } from './users-table';
import { __resetAdminMocks } from '@/lib/mock/admin';

// Компонент работает с реальным in-memory моком lib/mock/admin.ts
// (mockFetchUsers асинхронный, setUserStatus мутирует общий store) —
// сбрасываем seed перед каждым кейсом.
beforeEach(() => {
  __resetAdminMocks();
});

function rowOf(userName: string): HTMLElement {
  const row = screen.getByText(userName).closest('tr');
  if (!row) throw new Error(`Строка таблицы для «${userName}» не найдена`);
  return row;
}

test('renders a row per seeded user with masked phone, registration date and status', async () => {
  render(<UsersTable />);

  expect(await screen.findByText('Baxtiyor Alimov')).toBeInTheDocument();
  // 8 засеянных пользователей + строка заголовков.
  expect(screen.getAllByRole('row')).toHaveLength(9);

  const row = rowOf('Baxtiyor Alimov');
  // Телефон приходит уже маскированным (BR-3, NFR-15).
  expect(within(row).getByText('+998 ** *** ** 45')).toBeInTheDocument();
  expect(within(row).getByText('14.09.2025')).toBeInTheDocument();
  expect(within(row).getByText('Активен')).toBeInTheDocument();
});

test('offers suspend/ban for ACTIVE users and restore for suspended/banned ones', async () => {
  render(<UsersTable />);
  await screen.findByText('Baxtiyor Alimov');

  const activeRow = rowOf('Baxtiyor Alimov');
  expect(within(activeRow).getByRole('button', { name: 'Заморозить' })).toBeInTheDocument();
  expect(within(activeRow).getByRole('button', { name: 'Забанить' })).toBeInTheDocument();
  expect(within(activeRow).queryByRole('button', { name: 'Разблокировать' })).not.toBeInTheDocument();

  // user-6 засеян как BANNED, user-4 — как SUSPENDED.
  const bannedRow = rowOf('Jasur Toshpulatov');
  expect(within(bannedRow).getByText('Забанен')).toBeInTheDocument();
  expect(within(bannedRow).getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
  expect(within(bannedRow).queryByRole('button', { name: 'Забанить' })).not.toBeInTheDocument();

  const suspendedRow = rowOf('Dilshod Rahimov');
  expect(within(suspendedRow).getByText('Заморожен')).toBeInTheDocument();
  expect(within(suspendedRow).getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
});

test('banning an active user swaps the row to «Забанен» with a restore button', async () => {
  const user = userEvent.setup();
  render(<UsersTable />);
  await screen.findByText('Baxtiyor Alimov');

  const row = rowOf('Baxtiyor Alimov');
  await user.click(within(row).getByRole('button', { name: 'Забанить' }));

  expect(within(row).getByText('Забанен')).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: 'Забанить' })).not.toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: 'Заморозить' })).not.toBeInTheDocument();
});

test('restoring a banned user returns the row to «Активен» with suspend/ban actions', async () => {
  const user = userEvent.setup();
  render(<UsersTable />);
  await screen.findByText('Jasur Toshpulatov');

  const row = rowOf('Jasur Toshpulatov');
  await user.click(within(row).getByRole('button', { name: 'Разблокировать' }));

  expect(within(row).getByText('Активен')).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Заморозить' })).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Забанить' })).toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: 'Разблокировать' })).not.toBeInTheDocument();
});
