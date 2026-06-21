const { roundMoney, toNumber, toPositiveInt } = require('../../src/utils/numbers');

describe('number helpers', () => {
  it('normalizes nullish values to 0 and numeric strings to numbers', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('12.5')).toBe(12.5);
  });

  it('rounds money to two decimal places', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(99.994)).toBe(99.99);
  });

  it('coerces positive integers with fallback and max bounds', () => {
    expect(toPositiveInt('5', 1, 100)).toBe(5);
    expect(toPositiveInt('0', 1, 100)).toBe(1);
    expect(toPositiveInt('500', 1, 100)).toBe(100);
  });
});
