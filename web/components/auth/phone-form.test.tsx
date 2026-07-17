import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { PhoneForm } from './phone-form';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
}));

const otp = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
}));

const gdpr = vi.hoisted(() => ({
  saveConsents: vi.fn(),
}));

// Форма ходит через локале-осведомлённый роутер next-intl, не через next/navigation.
// Link нужен лейблу согласия ПД (ссылка на /privacy внутри t.rich).
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/mock/otp', () => ({
  mockSendOtp: otp.mockSendOtp,
}));

// Согласия при регистрации персистятся через saveConsents (FE-9, ЗРУ-547) —
// мокаем, чтобы проверять вызов, а не состояние localStorage.
vi.mock('@/lib/gdpr/consent', () => ({
  saveConsents: gdpr.saveConsents,
}));

const VALID_PHONE = '+998901234567';

// Лейбл содержит inline-ссылку на политику, поэтому матчим по началу текста.
const PERSONAL_DATA_LABEL = /Соглашаюсь на обработку персональных данных/;
const MARKETING_LABEL = 'Согласен получать маркетинговые уведомления';

beforeEach(() => {
  nav.push.mockClear();
  otp.mockSendOtp.mockReset();
  otp.mockSendOtp.mockResolvedValue({ ok: true });
  gdpr.saveConsents.mockClear();
});

test('renders the phone label and submit button', () => {
  render(<PhoneForm />);
  expect(screen.getByLabelText('Номер телефона')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Получить код' })).toBeInTheDocument();
});

test('shows a validation error and does not call mockSendOtp for an invalid phone', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), '12345');
  await userEvent.click(screen.getByLabelText(PERSONAL_DATA_LABEL));
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  expect(await screen.findByText('Введите номер в формате +998901234567')).toBeInTheDocument();
  expect(otp.mockSendOtp).not.toHaveBeenCalled();
  expect(nav.push).not.toHaveBeenCalled();
});

test('shows the consent error and does not call mockSendOtp without the personal data checkbox', async () => {
  render(<PhoneForm />);

  // Телефон валиден — блокирует сабмит именно несогласие на обработку ПД.
  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  expect(
    await screen.findByText('Для продолжения необходимо согласие на обработку персональных данных')
  ).toBeInTheDocument();
  expect(otp.mockSendOtp).not.toHaveBeenCalled();
  expect(gdpr.saveConsents).not.toHaveBeenCalled();
  expect(nav.push).not.toHaveBeenCalled();
});

test('calls mockSendOtp and redirects to /auth/otp with the phone on valid submit', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByLabelText(PERSONAL_DATA_LABEL));
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  await waitFor(() => expect(otp.mockSendOtp).toHaveBeenCalledWith(VALID_PHONE));
  expect(nav.push).toHaveBeenCalledWith(`/auth/otp?phone=${encodeURIComponent(VALID_PHONE)}`);
});

test('saves consents without marketing when only the personal data checkbox is checked', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByLabelText(PERSONAL_DATA_LABEL));
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  // marketing строго по клику: чекбокс маркетинга не трогали → false.
  await waitFor(() =>
    expect(gdpr.saveConsents).toHaveBeenCalledWith({ personalData: true, marketing: false })
  );
  expect(gdpr.saveConsents).toHaveBeenCalledTimes(1);
});

test('saves the marketing consent when its checkbox is also checked', async () => {
  render(<PhoneForm />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByLabelText(PERSONAL_DATA_LABEL));
  await userEvent.click(screen.getByLabelText(MARKETING_LABEL));
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  await waitFor(() =>
    expect(gdpr.saveConsents).toHaveBeenCalledWith({ personalData: true, marketing: true })
  );
});

test('includes the returnTo prop as a return query param when provided', async () => {
  render(<PhoneForm returnTo="/catalog/42" />);

  await userEvent.type(screen.getByLabelText('Номер телефона'), VALID_PHONE);
  await userEvent.click(screen.getByLabelText(PERSONAL_DATA_LABEL));
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));

  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      `/auth/otp?phone=${encodeURIComponent(VALID_PHONE)}&return=${encodeURIComponent('/catalog/42')}`
    )
  );
});
