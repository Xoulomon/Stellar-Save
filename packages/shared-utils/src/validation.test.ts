import { describe, expect, it } from 'vitest';

import {
  STELLAR_ADDRESS_REGEX,
  clampLimit,
  clampOffset,
  isPositiveNumber,
  isValidEmail,
  isValidStellarAddress,
} from './validation';

describe('shared validation helpers', () => {
  describe('isValidStellarAddress', () => {
    it('accepts a valid 56-character G address', () => {
      const address = `G${'A'.repeat(55)}`;
      expect(address).toMatch(STELLAR_ADDRESS_REGEX);
      expect(isValidStellarAddress(address)).toBe(true);
    });

    it.each([
      '',
      'G',
      `G${'A'.repeat(54)}`,
      `G${'A'.repeat(56)}`,
      `M${'A'.repeat(55)}`,
      `G${'a'.repeat(55)}`,
      `G${'0'.repeat(55)}`,
      `G${'A'.repeat(54)}!`,
    ])('rejects malformed address %j', (address) => {
      expect(isValidStellarAddress(address)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it.each(['person@example.com', 'first.last+tag@example.co.uk'])('accepts %s', (email) => {
      expect(isValidEmail(email)).toBe(true);
    });

    it.each(['', 'plainaddress', '@example.com', 'person@', 'person@example', 'person @example.com'])(
      'rejects malformed email %j',
      (email) => expect(isValidEmail(email)).toBe(false),
    );
  });

  describe('pagination clamps', () => {
    it.each([
      [1, 1, 100],
      [50.9, 50, 100],
      [0, 1, 100],
      [-10, 1, 100],
      [200, 100, 100],
      [20, 20, 25],
    ])('clampLimit(%j, %j) is %j', (value, expected, max) => {
      expect(clampLimit(value, max)).toBe(expected);
    });

    it.each([[0, 0], [12.9, 12], [-5, 0], [Number.NaN, Number.NaN]])(
      'clampOffset(%j) is %j',
      (value, expected) => expect(clampOffset(value)).toBe(expected),
    );
  });

  describe('isPositiveNumber', () => {
    it.each(['1', '0.01', '1e3'])('accepts positive finite number %s', (value) => {
      expect(isPositiveNumber(value)).toBe(true);
    });

    it.each(['', '0', '-1', 'Infinity', '-Infinity', 'NaN', 'not-a-number'])(
      'rejects malformed/non-positive number %j',
      (value) => expect(isPositiveNumber(value)).toBe(false),
    );
  });
});
