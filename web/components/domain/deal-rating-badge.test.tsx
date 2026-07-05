import { render, screen } from '@/src/test/utils';
import { DealRatingBadge } from './deal-rating-badge';
import type { DealRatingLabel } from '@/types/listing';

const cases: Array<[DealRatingLabel, string]> = [
  ['GREAT_DEAL', 'Отличная сделка'],
  ['FAIR_PRICE', 'Честная цена'],
  ['OVERPRICED', 'Завышенная цена'],
  ['UNAVAILABLE', 'Оценка недоступна'],
];

test.each(cases)('renders the correct label for %s', (label, expectedText) => {
  render(<DealRatingBadge label={label} />);
  expect(screen.getByText(expectedText)).toBeInTheDocument();
});
