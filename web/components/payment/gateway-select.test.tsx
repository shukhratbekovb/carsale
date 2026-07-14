import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { GatewaySelect } from './gateway-select';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const payment = vi.hoisted(() => ({
  mockCreatePayment: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.searchParams,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

vi.mock('@/lib/mock/payment', () => ({
  mockCreatePayment: payment.mockCreatePayment,
}));

const LISTING_ID = '1';
const AMOUNT_UZS = 45_000;

function setSearchParams(params: Record<string, string>) {
  nav.searchParams = new URLSearchParams(params);
}

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  setSearchParams({});
  payment.mockCreatePayment.mockReset();
});

test('renders the amount and both gateway buttons', () => {
  setSearchParams({});
  render(<GatewaySelect listingId={LISTING_ID} amountUzs={AMOUNT_UZS} />);

  expect(screen.getByText('45 000 сум')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Payme' })).toBeInTheDocument();
});

test('creates the payment for the clicked gateway and navigates to the returned payment URL', async () => {
  payment.mockCreatePayment.mockResolvedValue({
    transactionId: 'pay_1',
    paymentUrl: '/payment/gateway-sim?tx=pay_1&gateway=click&listingId=1&amount=45000',
  });
  render(<GatewaySelect listingId={LISTING_ID} amountUzs={AMOUNT_UZS} />);

  await userEvent.click(screen.getByRole('button', { name: 'Click' }));

  expect(payment.mockCreatePayment).toHaveBeenCalledWith({
    listingId: LISTING_ID,
    amountUzs: AMOUNT_UZS,
    gateway: 'click',
  });
  // No prior failures to encode, so the payment URL is pushed as-is (no
  // trailing &failed= — encodeFailedGateways([]) is an empty, falsy string).
  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      '/payment/gateway-sim?tx=pay_1&gateway=click&listingId=1&amount=45000'
    )
  );
});

test('shows the unavailable hint under a gateway that already failed', () => {
  setSearchParams({ failed: 'click' });
  render(<GatewaySelect listingId={LISTING_ID} amountUzs={AMOUNT_UZS} />);

  const clickButton = screen.getByRole('button', { name: /Click/ });
  expect(clickButton).toHaveTextContent('Не сработал в прошлый раз — попробуйте другой способ');

  const paymeButton = screen.getByRole('button', { name: /Payme/ });
  expect(paymeButton).not.toHaveTextContent('Не сработал в прошлый раз — попробуйте другой способ');
});

test('carries forward previously failed gateways into the payment URL', async () => {
  setSearchParams({ failed: 'click' });
  payment.mockCreatePayment.mockResolvedValue({
    transactionId: 'pay_2',
    paymentUrl: '/payment/gateway-sim?tx=pay_2&gateway=payme&listingId=1&amount=45000',
  });
  render(<GatewaySelect listingId={LISTING_ID} amountUzs={AMOUNT_UZS} />);

  await userEvent.click(screen.getByRole('button', { name: /Payme/ }));

  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      '/payment/gateway-sim?tx=pay_2&gateway=payme&listingId=1&amount=45000&failed=click'
    )
  );
});

test('shows the create-failed message when creating the payment rejects', async () => {
  payment.mockCreatePayment.mockRejectedValue(new Error('network error'));
  render(<GatewaySelect listingId={LISTING_ID} amountUzs={AMOUNT_UZS} />);

  await userEvent.click(screen.getByRole('button', { name: 'Click' }));

  expect(await screen.findByText('Не удалось создать платёж')).toBeInTheDocument();
  expect(screen.getByText('Попробуйте ещё раз или выберите другой способ оплаты')).toBeInTheDocument();
  expect(nav.push).not.toHaveBeenCalled();
});
