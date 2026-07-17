import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { CheckboxField } from './checkbox-field';

// Тот же паттерн, что в реальном потребителе (auth/phone-form.tsx): чекбокс
// обязательного согласия через z.literal(true) — снятый чекбокс не проходит.
const hostSchema = z.object({
  agree: z.literal(true, 'Обязательное согласие'),
});

type HostValues = { agree: boolean };

// CheckboxField принимает RHF control, поэтому тестам нужен хост с useForm —
// как в select-field.test.tsx.
function Host({ onSubmit = () => {} }: { onSubmit?: (values: HostValues) => void }) {
  const { control, handleSubmit } = useForm<HostValues>({
    // z.literal(true) сужает тип до литерала, а невыбранный чекбокс — false;
    // каст резолвера — тот же приём, что в phone-form.tsx.
    resolver: zodResolver(hostSchema) as Resolver<HostValues>,
    defaultValues: { agree: false },
  });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} noValidate>
      <CheckboxField name="agree" control={control} label="Согласен с условиями" />
      <button type="submit">Далее</button>
    </form>
  );
}

test('renders the label linked to the checkbox via htmlFor/id=name', () => {
  render(<Host />);

  const checkbox = screen.getByLabelText('Согласен с условиями');
  expect(checkbox).toHaveAttribute('type', 'checkbox');
  expect(checkbox).toHaveAttribute('id', 'agree');
  expect(checkbox).not.toBeChecked();
});

test('clicking the checkbox toggles the form value passed to onSubmit', async () => {
  const onSubmit = vi.fn();
  render(<Host onSubmit={onSubmit} />);

  await userEvent.click(screen.getByLabelText('Согласен с условиями'));
  expect(screen.getByLabelText('Согласен с условиями')).toBeChecked();

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toEqual({ agree: true });
});

test('shows the validation error with aria-invalid/aria-describedby after an unchecked submit', async () => {
  const onSubmit = vi.fn();
  render(<Host onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onSubmit).not.toHaveBeenCalled();
  const error = await screen.findByText('Обязательное согласие');
  expect(error).toHaveAttribute('id', 'agree-error');

  const checkbox = screen.getByLabelText('Согласен с условиями');
  expect(checkbox).toHaveAttribute('aria-invalid', 'true');
  expect(checkbox).toHaveAttribute('aria-describedby', 'agree-error');
});

test('has no aria-invalid/aria-describedby while the field is valid', () => {
  render(<Host />);

  const checkbox = screen.getByLabelText('Согласен с условиями');
  expect(checkbox).not.toHaveAttribute('aria-invalid');
  expect(checkbox).not.toHaveAttribute('aria-describedby');
});
