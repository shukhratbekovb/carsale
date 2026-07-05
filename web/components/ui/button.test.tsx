import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { Button } from './button';

test('renders children and handles click', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Click me</Button>);

  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();

  await userEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('disables interaction when disabled prop is set', () => {
  render(<Button disabled>Click me</Button>);
  expect(screen.getByRole('button', { name: 'Click me' })).toBeDisabled();
});
