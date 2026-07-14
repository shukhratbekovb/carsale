import { bothGatewaysFailed, encodeFailedGateways, otherGateway, parseFailedGateways } from './gateway';

describe('otherGateway', () => {
  test('returns payme for click', () => {
    expect(otherGateway('click')).toBe('payme');
  });

  test('returns click for payme', () => {
    expect(otherGateway('payme')).toBe('click');
  });
});

describe('parseFailedGateways', () => {
  test('returns an empty array for null', () => {
    expect(parseFailedGateways(null)).toEqual([]);
  });

  test('returns an empty array for an empty string', () => {
    expect(parseFailedGateways('')).toEqual([]);
  });

  test('parses a single gateway', () => {
    expect(parseFailedGateways('click')).toEqual(['click']);
  });

  test('parses both gateways', () => {
    expect(parseFailedGateways('click,payme')).toEqual(['click', 'payme']);
  });

  test('deduplicates repeated values', () => {
    expect(parseFailedGateways('click,click,payme,click')).toEqual(['click', 'payme']);
  });

  test('ignores unknown gateway values', () => {
    expect(parseFailedGateways('stripe,click,paypal')).toEqual(['click']);
  });

  test('returns an empty array when only unknown values are present', () => {
    expect(parseFailedGateways('stripe')).toEqual([]);
  });
});

describe('encodeFailedGateways', () => {
  test('joins gateways with a comma', () => {
    expect(encodeFailedGateways(['click', 'payme'])).toBe('click,payme');
  });

  test('deduplicates repeated gateways', () => {
    expect(encodeFailedGateways(['click', 'click', 'payme'])).toBe('click,payme');
  });

  test('returns an empty string for an empty list', () => {
    expect(encodeFailedGateways([])).toBe('');
  });
});

describe('bothGatewaysFailed', () => {
  test('is false for an empty list', () => {
    expect(bothGatewaysFailed([])).toBe(false);
  });

  test('is false when only one gateway failed', () => {
    expect(bothGatewaysFailed(['click'])).toBe(false);
    expect(bothGatewaysFailed(['payme'])).toBe(false);
  });

  test('is true when both gateways failed', () => {
    expect(bothGatewaysFailed(['click', 'payme'])).toBe(true);
  });
});
