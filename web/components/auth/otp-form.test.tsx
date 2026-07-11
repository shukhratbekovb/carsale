import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { OtpForm } from './otp-form';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const otp = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
}));

// useSearchParams остаётся из next/navigation, а роутер и Link форма берёт из
// локале-осведомлённого @/i18n/navigation — мокаем оба модуля по отдельности.
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.searchParams,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/mock/otp', () => ({
  mockSendOtp: otp.mockSendOtp,
  mockVerifyOtp: otp.mockVerifyOtp,
}));

const PHONE = '+998901234567';
const VALID_CODE_INPUT = '123456';

function setSearchParams(params: Record<string, string>) {
  nav.searchParams = new URLSearchParams(params);
}

async function submitCode(code: string) {
  const input = screen.getByLabelText('Код из SMS');
  await userEvent.clear(input);
  await userEvent.type(input, code);
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
}

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  setSearchParams({});
  otp.mockSendOtp.mockReset();
  otp.mockSendOtp.mockResolvedValue({ ok: true });
  otp.mockVerifyOtp.mockReset();
  otp.mockVerifyOtp.mockResolvedValue(false);
});

test('redirects to /auth/login when there is no phone search param', () => {
  const { container } = render(<OtpForm />);

  expect(nav.replace).toHaveBeenCalledWith('/auth/login');
  expect(container).toBeEmptyDOMElement();
});

test('renders the sent-code message and code input when phone is present', () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);

  expect(screen.getByText(`Код отправлен на ${PHONE}`)).toBeInTheDocument();
  expect(screen.getByLabelText('Код из SMS')).toBeInTheDocument();
  expect(nav.replace).not.toHaveBeenCalled();
});

test('shows the remaining attempts message on a wrong code and does not navigate', async () => {
  setSearchParams({ phone: PHONE });
  otp.mockVerifyOtp.mockResolvedValue(false);
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  expect(await screen.findByText('Неверный код. Осталось попыток: 2')).toBeInTheDocument();
  expect(nav.push).not.toHaveBeenCalled();
});

test('navigates to the return param on a correct code', async () => {
  setSearchParams({ phone: PHONE, return: '/catalog/42' });
  otp.mockVerifyOtp.mockResolvedValue(true);
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/catalog/42'));
});

test('navigates to / on a correct code when there is no return param', async () => {
  setSearchParams({ phone: PHONE });
  otp.mockVerifyOtp.mockResolvedValue(true);
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/'));
});

test('disables the resend button immediately after the code is sent', () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);

  expect(screen.getByRole('button', { name: /Отправить повторно/ })).toBeDisabled();
});

test('shows the locked state after exhausting all attempts', async () => {
  setSearchParams({ phone: PHONE });
  otp.mockVerifyOtp.mockResolvedValue(false);
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);
  await screen.findByText('Неверный код. Осталось попыток: 2');

  await submitCode(VALID_CODE_INPUT);
  await screen.findByText('Неверный код. Осталось попыток: 1');

  await submitCode(VALID_CODE_INPUT);

  expect(await screen.findByText('Слишком много попыток')).toBeInTheDocument();
  expect(screen.queryByLabelText('Код из SMS')).not.toBeInTheDocument();
});
