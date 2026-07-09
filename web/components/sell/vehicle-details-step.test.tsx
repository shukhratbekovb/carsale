import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { VehicleDetailsStep } from './vehicle-details-step';

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText('Марка'), 'Chevrolet');
  await userEvent.type(screen.getByLabelText('Модель'), 'Cobalt');
  await userEvent.type(screen.getByLabelText('Год выпуска'), '2019');
  await userEvent.type(screen.getByLabelText('Пробег, км'), '78000');
  await userEvent.selectOptions(screen.getByLabelText('Состояние'), 'GOOD');
  await userEvent.selectOptions(screen.getByLabelText('Коробка передач'), 'AUTOMATIC');
  await userEvent.selectOptions(screen.getByLabelText('Привод'), 'FWD');
  await userEvent.selectOptions(screen.getByLabelText('Город'), 'Ташкент');
  await userEvent.type(screen.getByLabelText('Цена, UZS'), '95000000');
}

test('renders all FR-02 fields', () => {
  render(<VehicleDetailsStep draft={{}} onComplete={vi.fn()} />);

  expect(screen.getByLabelText('Марка')).toBeInTheDocument();
  expect(screen.getByLabelText('Модель')).toBeInTheDocument();
  expect(screen.getByLabelText('Год выпуска')).toBeInTheDocument();
  expect(screen.getByLabelText('Пробег, км')).toBeInTheDocument();
  expect(screen.getByLabelText('Состояние')).toBeInTheDocument();
  expect(screen.getByLabelText('Цвет')).toBeInTheDocument();
  expect(screen.getByLabelText('Коробка передач')).toBeInTheDocument();
  expect(screen.getByLabelText('Привод')).toBeInTheDocument();
  expect(screen.getByLabelText('Объём двигателя, л')).toBeInTheDocument();
  expect(screen.getByLabelText('Тип топлива')).toBeInTheDocument();
  expect(screen.getByLabelText('Город')).toBeInTheDocument();
  expect(screen.getByLabelText('Цена, UZS')).toBeInTheDocument();
});

test('does not call onComplete when required fields are missing', async () => {
  const onComplete = vi.fn();
  render(<VehicleDetailsStep draft={{}} onComplete={onComplete} />);

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onComplete).not.toHaveBeenCalled();
});

test('calls onComplete with parsed values when the form is valid', async () => {
  const onComplete = vi.fn();
  render(<VehicleDetailsStep draft={{}} onComplete={onComplete} />);

  await fillRequiredFields();
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  // handleSubmit(onComplete) passes the submit SyntheticEvent as a 2nd argument —
  // assert on the first call's first argument rather than toHaveBeenCalledWith,
  // which requires every argument to match.
  expect(onComplete.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      make: 'Chevrolet',
      model: 'Cobalt',
      year: 2019,
      mileageKm: 78000,
      condition: 'GOOD',
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
      city: 'Ташкент',
      priceUzs: 95000000,
    })
  );
});

// Регрессия: color опционален в схеме (min(1).optional()) — пустая строка не
// проходит .optional() (только undefined), поэтому defaultValues не должен
// подставлять '' для необязательных полей (см. комментарий в самом компоненте).
test('submits successfully when the optional color field is left blank', async () => {
  const onComplete = vi.fn();
  render(<VehicleDetailsStep draft={{}} onComplete={onComplete} />);

  await fillRequiredFields();
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onComplete).toHaveBeenCalled();
});

test('prefills fields from an existing draft', () => {
  render(
    <VehicleDetailsStep
      draft={{ make: 'BMW', model: 'X5', year: 2021 }}
      onComplete={vi.fn()}
    />
  );

  expect(screen.getByLabelText('Марка')).toHaveValue('BMW');
  expect(screen.getByLabelText('Модель')).toHaveValue('X5');
  expect(screen.getByLabelText('Год выпуска')).toHaveValue(2021);
});
