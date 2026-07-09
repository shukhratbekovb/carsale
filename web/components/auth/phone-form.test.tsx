import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { PhoneForm } from './phone-form';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
}));

const otp = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock('@/lib/mock/otp', () => ({
  mockSendOtp: otp.mockSendOtp,
}));

const VALID_PHONE = '+998901234567';

beforeEach(() => {
  nav.push.mockClear();
  otp.mockSendOtp.mockReset();
  otp.mockSendOtp.mockResolvedValue({ ok: true });
});

test('renders the phone label and submit button', () => {
  render(<PhoneForm />);
  expect(screen.getByLabelText('Номер телефона')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Получить код' })).toBeInTheDocument();
});

test('shows a validation error and does not call mockSendOtp for an invalid phone', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), '12345');
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  expect(await screen.findByText('Введите номер в формате +998901234567')).toBeInTheDocument();
  expect(otp.mockSendOtp).not.toHaveBeenCalled();
  expect(nav.push).not.toHaveBeenCalled();
});

test('calls mockSendOtp and redirects to /auth/otp with the phone on valid submit', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  await waitFor(() => expect(otp.mockSendOtp).toHaveBeenCalledWith(VALID_PHONE));
  expect(nav.push).toHaveBeenCalledWith(`/auth/otp?phone=${encodeURIComponent(VALID_PHONE)}`);
});

test('includes the returnTo prop as a return query param when provided', async () => {
  render(<PhoneForm returnTo="/catalog/42" />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      `/auth/otp?phone=${encodeURIComponent(VALID_PHONE)}&return=${encodeURIComponent('/catalog/42')}`
    )
  );
});
