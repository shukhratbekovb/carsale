import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { SelectField } from './select-field';

const CONDITION_VALUES = ['GOOD', 'FAIR'] as const;

const hostSchema = z.object({
  // Сообщение намеренно отличается от placeholder'а, чтобы getByText
  // однозначно находил <p> с ошибкой, а не <option> плейсхолдера.
  condition: z.enum(CONDITION_VALUES, 'Обязательное поле'),
});

type HostValues = z.infer<typeof hostSchema>;

const conditionOptions = [
  { value: 'GOOD', label: 'Хорошее' },
  { value: 'FAIR', label: 'Среднее' },
];

// SelectField принимает RHF control, поэтому тестам нужен хост с useForm.
// defaultValues намеренно не заданы: начальное field.value === undefined —
// это же покрывает fallback value={field.value ?? ''} в контролируемом select.
function Host({ onSubmit = () => {} }: { onSubmit?: (values: HostValues) => void }) {
  const { control, handleSubmit } = useForm<HostValues>({
    resolver: zodResolver(hostSchema),
  });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))}>
      <SelectField
        name="condition"
        control={control}
        label="Состояние"
        placeholder="Выберите состояние"
        options={conditionOptions}
      />
      <button type="submit">Далее</button>
    </form>
  );
}

test('renders the label linked to the select via htmlFor/id=name', () => {
  render(<Host />);

  const select = screen.getByLabelText('Состояние');
  expect(select.tagName).toBe('SELECT');
  expect(select).toHaveAttribute('id', 'condition');
});

test('renders all options plus a disabled placeholder with an empty value', () => {
  render(<Host />);

  const placeholder = screen.getByRole('option', { name: 'Выберите состояние' });
  expect(placeholder).toBeDisabled();
  expect(placeholder).toHaveValue('');

  expect(screen.getByRole('option', { name: 'Хорошее' })).toHaveValue('GOOD');
  expect(screen.getByRole('option', { name: 'Среднее' })).toHaveValue('FAIR');
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

test('selecting an option updates the form value passed to onSubmit', async () => {
  const onSubmit = vi.fn();
  render(<Host onSubmit={onSubmit} />);

  await userEvent.selectOptions(screen.getByLabelText('Состояние'), 'GOOD');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toEqual({ condition: 'GOOD' });
});

test('shows the validation error and destructive border after submitting an empty required field', async () => {
  const onSubmit = vi.fn();
  render(<Host onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
  expect(screen.getByLabelText('Состояние')).toHaveClass('border-destructive');
});

// Регрессия для value={field.value ?? ''}: без defaultValues field.value === undefined,
// и без fallback'а React ругался бы на переход uncontrolled -> controlled.
test('renders with an undefined form value without warnings and shows the placeholder', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    render(<Host />);

    expect(screen.getByLabelText('Состояние')).toHaveValue('');
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});
