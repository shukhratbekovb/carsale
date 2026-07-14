import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { GatewaySimulator } from './gateway-simulator';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.searchParams,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

function setSearchParams(params: Record<string, string>) {
  nav.searchParams = new URLSearchParams(params);
}

const VALID_PARAMS = {
  tx: 'pay_1',
  gateway: 'click',
  listingId: '1',
  amount: '45000',
};

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  setSearchParams({});
});

test('renders the amount and both action buttons for a valid session', () => {
  setSearchParams(VALID_PARAMS);
  render(<GatewaySimulator />);

  expect(screen.getByText('45 000 сум')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Оплатить/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Отменить платёж' })).toBeInTheDocument();
  expect(nav.replace).not.toHaveBeenCalled();
});

test('pushes to /payment/return with outcome=success and the original params on Pay', async () => {
  setSearchParams(VALID_PARAMS);
  render(<GatewaySimulator />);

  await userEvent.click(screen.getByRole('button', { name: /Оплатить/ }));

  const pushedUrl = nav.push.mock.calls[0][0] as string;
  const params = new URLSearchParams(pushedUrl.split('?')[1]);
  expect(pushedUrl.startsWith('/payment/return?')).toBe(true);
  expect(params.get('tx')).toBe('pay_1');
  expect(params.get('gateway')).toBe('click');
  expect(params.get('listingId')).toBe('1');
  expect(params.get('amount')).toBe('45000');
  expect(params.get('outcome')).toBe('success');
  expect(params.has('failed')).toBe(false);
});

test('pushes to /payment/return with outcome=declined on Cancel', async () => {
  setSearchParams(VALID_PARAMS);
  render(<GatewaySimulator />);

  await userEvent.click(screen.getByRole('button', { name: 'Отменить платёж' }));

  const pushedUrl = nav.push.mock.calls[0][0] as string;
  const params = new URLSearchParams(pushedUrl.split('?')[1]);
  expect(params.get('outcome')).toBe('declined');
});

test('carries forward the failed query param into the return URL', async () => {
  setSearchParams({ ...VALID_PARAMS, failed: 'click' });
  render(<GatewaySimulator />);

  await userEvent.click(screen.getByRole('button', { name: 'Отменить платёж' }));

  const pushedUrl = nav.push.mock.calls[0][0] as string;
  const params = new URLSearchParams(pushedUrl.split('?')[1]);
  expect(params.get('failed')).toBe('click');
});

test('redirects to /catalog and renders nothing when required params are missing', () => {
  setSearchParams({});
  const { container } = render(<GatewaySimulator />);

  expect(nav.replace).toHaveBeenCalledWith('/catalog');
  expect(container).toBeEmptyDOMElement();
});
