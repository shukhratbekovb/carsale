import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/client';
import { render, screen, waitFor } from '@/src/test/utils';
import { OtpForm } from './otp-form';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const api = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

const session = vi.hoisted(() => ({ login: vi.fn() }));

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

vi.mock('@/lib/auth/auth-api', () => ({
  sendOtp: api.sendOtp,
  verifyOtp: api.verifyOtp,
}));

vi.mock('@/lib/auth/session', () => ({
  useSession: () => ({ login: session.login }),
}));

vi.mock('@/lib/gdpr/consent', () => ({
  readConsents: () => ({ personalData: true, marketing: true, acceptedAt: null }),
}));

const PHONE = '+998901234567';
const VALID_CODE_INPUT = '123456';
const USER = {
  id: 'u1',
  role: 'BUYER' as const,
  verificationStatus: 'PHONE_VERIFIED',
  email: null,
  marketingConsent: true,
  createdAt: '2026-07-25T00:00:00.000Z',
};

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
  session.login.mockClear();
  setSearchParams({});
  api.sendOtp.mockReset();
  api.sendOtp.mockResolvedValue({ expiresIn: 300 });
  api.verifyOtp.mockReset();
  // По умолчанию — неверный код (Core отвечает 400 invalid_otp)
  api.verifyOtp.mockRejectedValue(new ApiError(400, 'invalid_otp', 'Invalid code'));
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

test('sends the OTP once on mount', async () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);
  await waitFor(() => expect(api.sendOtp).toHaveBeenCalledWith(PHONE));
});

test('shows the remaining attempts message on a wrong code and does not navigate', async () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  expect(await screen.findByText('Неверный код. Осталось попыток: 2')).toBeInTheDocument();
  expect(nav.push).not.toHaveBeenCalled();
  expect(session.login).not.toHaveBeenCalled();
});

test('logs in and navigates to the return param on a correct code', async () => {
  setSearchParams({ phone: PHONE, return: '/catalog/42' });
  api.verifyOtp.mockResolvedValue({ accessToken: 'tok-1', user: USER });
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  await waitFor(() => expect(session.login).toHaveBeenCalledWith('tok-1', USER));
  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/catalog/42'));
});

test('navigates to / on a correct code when there is no return param', async () => {
  setSearchParams({ phone: PHONE });
  api.verifyOtp.mockResolvedValue({ accessToken: 'tok-1', user: USER });
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/'));
});

test('passes the saved marketing consent to verifyOtp', async () => {
  setSearchParams({ phone: PHONE });
  api.verifyOtp.mockResolvedValue({ accessToken: 'tok-1', user: USER });
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);

  await waitFor(() =>
    expect(api.verifyOtp).toHaveBeenCalledWith({
      phone: PHONE,
      code: VALID_CODE_INPUT,
      marketingConsent: true,
    }),
  );
});

test('disables the resend button immediately after the code is sent', () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);

  expect(screen.getByRole('button', { name: /Отправить повторно/ })).toBeDisabled();
});

test('shows the locked state after exhausting all attempts', async () => {
  setSearchParams({ phone: PHONE });
  render(<OtpForm />);

  await submitCode(VALID_CODE_INPUT);
  await screen.findByText('Неверный код. Осталось попыток: 2');

  await submitCode(VALID_CODE_INPUT);
  await screen.findByText('Неверный код. Осталось попыток: 1');

  await submitCode(VALID_CODE_INPUT);

  expect(await screen.findByText('Слишком много попыток')).toBeInTheDocument();
  expect(screen.queryByLabelText('Код из SMS')).not.toBeInTheDocument();
});
