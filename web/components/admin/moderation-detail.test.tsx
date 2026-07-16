import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import { ModerationDetail } from './moderation-detail';
import { __resetAdminMocks, getModerationItem } from '@/lib/mock/admin';
import type { ModerationItem } from '@/types/admin';

// pushNotification мокаем (как в notification-bell.test.tsx мокается сам
// мок-модуль): здесь проверяем только факт и форму вызова, поведение
// тостов/колокольчика покрыто своими тестами.
const notifications = vi.hoisted(() => ({ pushNotification: vi.fn() }));

vi.mock('@/lib/mock/notifications', () => ({
  pushNotification: notifications.pushNotification,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

// Харнесс повторяет родительскую страницу admin/moderation/[id]/page.tsx:
// item живёт в state и обновляется через onDecided — так проверяется
// реальный флоу «кнопки исчезают, появляется блок решения».
function Harness({ id }: { id: string }) {
  const [item, setItem] = useState<ModerationItem>(() => getModerationItem(id)!);
  return <ModerationDetail item={item} onDecided={setItem} />;
}

beforeEach(() => {
  // approve/reject мутируют общий in-memory store админ-мока.
  __resetAdminMocks();
  notifications.pushNotification.mockReset();
});

// mod-1 — DUPLICATE_PHOTOS (оригинал — объявление '1' публичного каталога).
test('DUPLICATE_PHOTOS flag links to the original listing in the public catalog', () => {
  render(<Harness id="mod-1" />);

  expect(screen.getByText('Дубликат фото')).toBeInTheDocument();
  expect(
    screen.getByText('Фотографии совпадают с уже опубликованным объявлением.')
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Открыть объявление-оригинал' })).toHaveAttribute(
    'href',
    '/catalog/1'
  );
});

// mod-2 — PRICE_ANOMALY с deviationPercent: 45 и рекомендованным диапазоном.
test('PRICE_ANOMALY flag shows the deviation percent and the recommended range', () => {
  render(<Harness id="mod-2" />);

  expect(screen.getByText('Аномальная цена −45%')).toBeInTheDocument();
  expect(
    screen.getByText('Цена на 45% ниже рыночной оценки для аналогичных автомобилей.')
  ).toBeInTheDocument();
  expect(
    screen.getByText('Рекомендованный диапазон: 118 000 000 сум – 130 000 000 сум')
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Открыть объявление-оригинал' })).not.toBeInTheDocument();
});

test('approving publishes the listing, hides the decision buttons and notifies the seller', async () => {
  const user = userEvent.setup();
  render(<Harness id="mod-1" />);

  await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

  // Бейдж статуса дважды: в шапке и в блоке решения.
  expect(screen.getAllByText('Опубликовано')).toHaveLength(2);
  expect(screen.getByText('Решение')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Отклонить' })).not.toBeInTheDocument();

  // UC-15 шаг 4: продавец получает уведомление о решении.
  expect(notifications.pushNotification).toHaveBeenCalledTimes(1);
  expect(notifications.pushNotification).toHaveBeenCalledWith(
    'LISTING_STATUS',
    expect.any(String),
    expect.any(String),
    '/my-listings'
  );
});

test('rejecting requires a reason, then shows the decision with reason and comment', async () => {
  const user = userEvent.setup();
  render(<Harness id="mod-2" />);

  await user.click(screen.getByRole('button', { name: 'Отклонить' }));

  // Без выбранной причины подтверждение заблокировано.
  const submit = screen.getByRole('button', { name: 'Подтвердить отклонение' });
  expect(submit).toBeDisabled();

  await user.selectOptions(screen.getByLabelText('Причина отклонения'), 'FRAUD_PRICE');
  await user.type(screen.getByLabelText('Комментарий (необязательно)'), 'Цена вдвое ниже рынка');
  expect(submit).toBeEnabled();
  await user.click(submit);

  expect(screen.getAllByText('Отклонено')).toHaveLength(2);
  expect(screen.getByText('Мошенническая цена')).toBeInTheDocument();
  expect(screen.getByText('Цена вдвое ниже рынка')).toBeInTheDocument();
  // Форма закрылась вместе с кнопками решения.
  expect(screen.queryByLabelText('Причина отклонения')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument();

  expect(notifications.pushNotification).toHaveBeenCalledTimes(1);
  expect(notifications.pushNotification).toHaveBeenCalledWith(
    'LISTING_STATUS',
    expect.any(String),
    expect.any(String),
    '/my-listings'
  );
});

test('cancelling the reject form closes it without deciding or notifying', async () => {
  const user = userEvent.setup();
  render(<Harness id="mod-1" />);

  await user.click(screen.getByRole('button', { name: 'Отклонить' }));
  expect(screen.getByLabelText('Причина отклонения')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Отмена' }));

  expect(screen.queryByLabelText('Причина отклонения')).not.toBeInTheDocument();
  // Item остался PENDING — обе кнопки решения на месте.
  expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeInTheDocument();
  expect(screen.getByText('Ожидает решения')).toBeInTheDocument();
  expect(notifications.pushNotification).not.toHaveBeenCalled();
});
