import {
  isValidStellarAddress,
  isValidEmail,
  isValidUrl,
  isValidPositiveNumber,
  isValidNumberInRange,
  isValidStringLength,
  commonValidators,
} from '../lib/validation';

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q';

describe('isValidStellarAddress', () => {
  it.each([
    [VALID_ADDRESS, true],
    [`  ${VALID_ADDRESS}  `, true], // trimmed
    ['NotAStellarAddress', false],
    ['', false],
    [VALID_ADDRESS.slice(0, -1), false], // one char short
    [`G${VALID_ADDRESS.slice(1).toLowerCase()}`, false], // lowercase body is rejected
    [`A${VALID_ADDRESS.slice(1)}`, false], // wrong leading letter
  ])('isValidStellarAddress(%p) -> %p', (input, expected) => {
    expect(isValidStellarAddress(input)).toBe(expected);
  });
});

describe('isValidEmail', () => {
  it.each([
    ['user@example.com', true],
    ['  user@example.com  ', true],
    ['user.name+tag@example.co.uk', true],
    ['not-an-email', false],
    ['', false],
    ['@example.com', false],
    ['user@', false],
    ['user@example', false], // no dot in the domain part
  ])('isValidEmail(%p) -> %p', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe('isValidUrl', () => {
  it('treats an empty string as valid (optional field)', () => {
    expect(isValidUrl('')).toBe(true);
  });

  it.each([
    ['https://example.com', true],
    ['http://example.com/path?query=1', true],
    ['example.com', true],
    ['not a url', false],
  ])('isValidUrl(%p) -> %p', (input, expected) => {
    expect(isValidUrl(input)).toBe(expected);
  });
});

describe('isValidPositiveNumber', () => {
  it.each([
    [1, true],
    [0.0001, true],
    [0, false], // zero is not positive
    [-1, false], // negative
    [Number.MAX_SAFE_INTEGER, true], // maximum
    ['5', true],
    ['-5', false],
    ['not-a-number', false],
    [NaN, false],
  ])('isValidPositiveNumber(%p) -> %p', (input, expected) => {
    expect(isValidPositiveNumber(input as number | string)).toBe(expected);
  });
});

describe('isValidNumberInRange', () => {
  it.each([
    [0, 0, 10, true], // zero at the lower bound
    [10, 0, 10, true], // maximum at the upper bound
    [-1, 0, 10, false], // just below the range
    [11, 0, 10, false], // just above the range
    [-5, -10, -1, true], // negative range, value inside
    [5, 10, 0, false], // inverted min/max never matches
    ['5', 0, 10, true],
    ['abc', 0, 10, false],
  ])('isValidNumberInRange(%p, %p, %p) -> %p', (val, min, max, expected) => {
    expect(isValidNumberInRange(val as number | string, min, max)).toBe(expected);
  });
});

describe('isValidStringLength', () => {
  it.each([
    ['', 0, 5, true], // empty string, zero minimum
    ['', 1, 5, false], // empty string, non-zero minimum
    ['abc', 3, 3, true], // exactly at both bounds
    ['  abc  ', 3, 3, true], // trimmed before measuring
    ['abcdef', 0, 5, false], // over the maximum
  ])('isValidStringLength(%p, %p, %p) -> %p', (str, min, max, expected) => {
    expect(isValidStringLength(str, min, max)).toBe(expected);
  });
});

describe('commonValidators.stellarAddress', () => {
  it('accepts a valid address', () => {
    expect(commonValidators.stellarAddress.safeParse(VALID_ADDRESS).success).toBe(true);
  });

  it('rejects an invalid address with a helpful message', () => {
    const result = commonValidators.stellarAddress.safeParse('bad-address');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Invalid Stellar public key/);
    }
  });
});

describe('commonValidators.positiveNumberString', () => {
  const schema = commonValidators.positiveNumberString(0, 'Amount');

  it.each([
    ['1', true],
    ['0', false], // not greater than the minimum
    ['-1', false],
    ['999999999', true], // maximum-ish
    ['abc', false],
  ])('positiveNumberString(0)(%p) -> %p', (input, expected) => {
    expect(schema.safeParse(input).success).toBe(expected);
  });

  it('uses a custom minimum', () => {
    const minFive = commonValidators.positiveNumberString(5, 'Stake');
    expect(minFive.safeParse('5').success).toBe(false); // must be greater than, not equal
    expect(minFive.safeParse('5.01').success).toBe(true);
  });
});

describe('commonValidators.boundedNumberString', () => {
  const schema = commonValidators.boundedNumberString(1, 10, 'Quantity');

  it.each([
    ['1', true],
    ['10', true],
    ['0', false],
    ['11', false],
  ])('boundedNumberString(1,10)(%p) -> %p', (input, expected) => {
    expect(schema.safeParse(input).success).toBe(expected);
  });
});

describe('commonValidators.nonEmptyString', () => {
  const schema = commonValidators.nonEmptyString(5, 'Name');

  it.each([
    ['', false],
    ['   ', false], // whitespace-only trims to empty
    ['a', true],
    ['abcde', true], // exactly at the maximum
    ['abcdef', false], // one over the maximum
  ])('nonEmptyString(5)(%p) -> %p', (input, expected) => {
    expect(schema.safeParse(input).success).toBe(expected);
  });
});
