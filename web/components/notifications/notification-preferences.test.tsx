import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { NotificationPreferences } from './notification-preferences';

const preferences = vi.hoisted(() => ({
  setPreference: vi.fn(),
  value: {
    NEW_MESSAGE: true,
    PRICE_DROP: true,
    LISTING_STATUS: true,
  },
}));

vi.mock('@/hooks/use-notification-preferences', () => ({
  useNotificationPreferences: () => ({
    preferences: preferences.value,
    setPreference: preferences.setPreference,
  }),
}));

beforeEach(() => {
  preferences.setPreference.mockReset();
  preferences.value = {
    NEW_MESSAGE: true,
    PRICE_DROP: true,
    LISTING_STATUS: true,
  };
});

test('renders one switch per notification type, checked according to the current preferences', () => {
  preferences.value = { NEW_MESSAGE: true, PRICE_DROP: false, LISTING_STATUS: true };
  render(<NotificationPreferences />);

  const switches = screen.getAllByRole('switch');
  expect(switches).toHaveLength(3);

  expect(screen.getByLabelText('Новые сообщения в чате')).toBeChecked();
  expect(screen.getByLabelText('Снижение цены на избранное')).not.toBeChecked();
  expect(screen.getByLabelText('Статус моих объявлений')).toBeChecked();
});

test('toggling a switch calls setPreference with its type and the new checked state', async () => {
  const user = userEvent.setup();
  render(<NotificationPreferences />);

  await user.click(screen.getByLabelText('Снижение цены на избранное'));

  expect(preferences.setPreference).toHaveBeenCalledWith('PRICE_DROP', false);
});

test('toggling an unchecked switch calls setPreference with true', async () => {
  preferences.value = { NEW_MESSAGE: false, PRICE_DROP: true, LISTING_STATUS: true };
  const user = userEvent.setup();
  render(<NotificationPreferences />);

  await user.click(screen.getByLabelText('Новые сообщения в чате'));

  expect(preferences.setPreference).toHaveBeenCalledWith('NEW_MESSAGE', true);
});
