import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { RejectForm } from './reject-form';

test('keeps the submit button disabled until a reason is selected', async () => {
  const user = userEvent.setup();
  render(<RejectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

  const submit = screen.getByRole('button', { name: 'Подтвердить отклонение' });
  expect(submit).toBeDisabled();

  await user.selectOptions(screen.getByLabelText('Причина отклонения'), 'DUPLICATE');
  expect(submit).toBeEnabled();
});

test('submits the selected reason together with the comment', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RejectForm onSubmit={onSubmit} onCancel={vi.fn()} />);

  await user.selectOptions(screen.getByLabelText('Причина отклонения'), 'FRAUD_PRICE');
  await user.type(screen.getByLabelText('Комментарий (необязательно)'), 'Цена вдвое ниже рынка');
  await user.click(screen.getByRole('button', { name: 'Подтвердить отклонение' }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith('FRAUD_PRICE', 'Цена вдвое ниже рынка');
});

test('submits undefined instead of a blank comment', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RejectForm onSubmit={onSubmit} onCancel={vi.fn()} />);

  await user.selectOptions(screen.getByLabelText('Причина отклонения'), 'OTHER');
  // Комментарий из одних пробелов приравнивается к отсутствию комментария.
  await user.type(screen.getByLabelText('Комментарий (необязательно)'), '   ');
  await user.click(screen.getByRole('button', { name: 'Подтвердить отклонение' }));

  expect(onSubmit).toHaveBeenCalledWith('OTHER', undefined);
});

test('the cancel button calls onCancel without submitting', async () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<RejectForm onSubmit={onSubmit} onCancel={onCancel} />);

  await user.click(screen.getByRole('button', { name: 'Отмена' }));

  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
