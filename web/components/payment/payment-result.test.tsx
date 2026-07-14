import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { PaymentResult } from './payment-result';

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
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/mock/payment', () => ({
  mockCreatePayment: payment.mockCreatePayment,
}));

function setSearchParams(params: Record<string, string>) {
  nav.searchParams = new URLSearchParams(params);
}

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  setSearchParams({});
  payment.mockCreatePayment.mockReset();
});

test('shows the success message, amount, and a link back to the listing', () => {
  setSearchParams({
    outcome: 'success',
    gateway: 'click',
    listingId: '1',
    amount: '45000',
  });
  render(<PaymentResult />);

  expect(screen.getByText('Оплата прошла успешно')).toBeInTheDocument();
  expect(screen.getByText('45 000 сум')).toBeInTheDocument();
  expect(screen.getByText('Квитанция отправлена на email, указанный в профиле.')).toBeInTheDocument();

  const link = screen.getByRole('link', { name: 'Вернуться к объявлению' });
  expect(link).toHaveAttribute('href', '/catalog/1');
  expect(nav.replace).not.toHaveBeenCalled();
});

test('shows the declined message with retry buttons when only one gateway failed', async () => {
  setSearchParams({
    outcome: 'declined',
    gateway: 'click',
    listingId: '1',
    amount: '45000',
  });
  payment.mockCreatePayment.mockResolvedValue({
    transactionId: 'pay_2',
    paymentUrl: '/payment/gateway-sim?tx=pay_2&gateway=payme&listingId=1&amount=45000',
  });
  render(<PaymentResult />);

  expect(screen.getByText('Платёж отклонён')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Повторить Click' })).toBeInTheDocument();
  const tryOtherButton = screen.getByRole('button', { name: 'Попробовать Payme' });
  expect(tryOtherButton).toBeInTheDocument();

  await userEvent.click(tryOtherButton);

  expect(payment.mockCreatePayment).toHaveBeenCalledWith({
    listingId: '1',
    amountUzs: 45000,
    gateway: 'payme',
  });
  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      '/payment/gateway-sim?tx=pay_2&gateway=payme&listingId=1&amount=45000&failed=click'
    )
  );
});

test('retrying with the same gateway requests a payment for that gateway', async () => {
  setSearchParams({
    outcome: 'declined',
    gateway: 'click',
    listingId: '1',
    amount: '45000',
  });
  payment.mockCreatePayment.mockResolvedValue({
    transactionId: 'pay_3',
    paymentUrl: '/payment/gateway-sim?tx=pay_3&gateway=click&listingId=1&amount=45000',
  });
  render(<PaymentResult />);

  await userEvent.click(screen.getByRole('button', { name: 'Повторить Click' }));

  expect(payment.mockCreatePayment).toHaveBeenCalledWith({
    listingId: '1',
    amountUzs: 45000,
    gateway: 'click',
  });
  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith(
      '/payment/gateway-sim?tx=pay_3&gateway=click&listingId=1&amount=45000&failed=click'
    )
  );
});

test('shows the both-failed message without retry buttons when the other gateway already failed', () => {
  setSearchParams({
    outcome: 'declined',
    gateway: 'payme',
    listingId: '1',
    amount: '45000',
    failed: 'click',
  });
  render(<PaymentResult />);

  expect(screen.getByText('Оплата сейчас недоступна')).toBeInTheDocument();
  expect(
    screen.getByText('Оба способа оплаты не сработали. Попробуйте, пожалуйста, позже.')
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Повторить/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Попробовать/ })).not.toBeInTheDocument();

  const link = screen.getByRole('link', { name: 'В каталог' });
  expect(link).toHaveAttribute('href', '/catalog');
});

test('redirects to /catalog and renders nothing for invalid or missing params', () => {
  setSearchParams({ outcome: 'success' });
  const { container } = render(<PaymentResult />);

  expect(nav.replace).toHaveBeenCalledWith('/catalog');
  expect(container).toBeEmptyDOMElement();
});
