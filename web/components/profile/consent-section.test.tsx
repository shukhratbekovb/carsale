import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { DEFAULT_CONSENT_STATE, type ConsentState } from '@/types/gdpr';
import { ConsentSection } from './consent-section';

// Секция — тонкий UI поверх lib/gdpr/consent: мокаем модуль, чтобы управлять
// прочитанным состоянием и проверять вызов setMarketingConsent, а не побочные
// эффекты в localStorage (они покрыты в lib/gdpr/consent.test.ts).
const consent = vi.hoisted(() => ({
  readConsents: vi.fn(),
  setMarketingConsent: vi.fn(),
}));

vi.mock('@/lib/gdpr/consent', () => consent);

const ACCEPTED_STATE: ConsentState = {
  personalData: true,
  marketing: false,
  acceptedAt: '2026-07-10T09:00:00.000Z',
};

beforeEach(() => {
  consent.readConsents.mockReset();
  consent.setMarketingConsent.mockReset();
});

test('shows the "not given yet" status and an unchecked switch without saved consents', () => {
  consent.readConsents.mockReturnValue(DEFAULT_CONSENT_STATE);

  render(<ConsentSection />);

  expect(screen.getByRole('heading', { name: 'Согласия' })).toBeInTheDocument();
  expect(
    screen.getByText(
      'Согласие на обработку персональных данных ещё не давалось — оно запрашивается при регистрации.'
    )
  ).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Маркетинговые уведомления' })).not.toBeChecked();
});

test('shows the acceptance date in DD.MM.YYYY format when consents were saved', () => {
  consent.readConsents.mockReturnValue(ACCEPTED_STATE);

  render(<ConsentSection />);

  expect(
    screen.getByText('Согласие на обработку персональных данных принято 10.07.2026.')
  ).toBeInTheDocument();
});

test('reflects the saved marketing consent in the switch state', () => {
  consent.readConsents.mockReturnValue({ ...ACCEPTED_STATE, marketing: true });

  render(<ConsentSection />);

  expect(screen.getByRole('switch', { name: 'Маркетинговые уведомления' })).toBeChecked();
});

test('toggling the switch calls setMarketingConsent and syncs with the returned state', async () => {
  consent.readConsents.mockReturnValue(ACCEPTED_STATE);
  // setMarketingConsent возвращает новое персистентное состояние — компонент
  // синхронизирует локальный state с ним, без повторного чтения storage.
  consent.setMarketingConsent.mockImplementation((enabled: boolean) => ({
    ...ACCEPTED_STATE,
    marketing: enabled,
  }));

  render(<ConsentSection />);

  await userEvent.click(screen.getByRole('switch', { name: 'Маркетинговые уведомления' }));

  expect(consent.setMarketingConsent).toHaveBeenCalledTimes(1);
  expect(consent.setMarketingConsent).toHaveBeenCalledWith(true);
  expect(screen.getByRole('switch', { name: 'Маркетинговые уведомления' })).toBeChecked();
});
