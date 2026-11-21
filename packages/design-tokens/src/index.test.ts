import { describe, it, expect } from 'vitest';
import {
  tokens,
  colors,
  spacing,
  radii,
  typography,
  resolveToken,
  getToken,
  isTokenPath,
} from './index';

describe('design tokens', () => {
  it('exposes the core token groups', () => {
    expect(colors).toBeDefined();
    expect(spacing).toBeDefined();
    expect(radii).toBeDefined();
    expect(typography).toBeDefined();
    expect(tokens).toBeDefined();
  });

  it('keeps token groups reachable from the root tokens object', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.spacing).toBe(spacing);
    expect(tokens.radii).toBe(radii);
    expect(tokens.typography).toBe(typography);
  });

  it('resolves a nested token path to its value', () => {
    const firstColorKey = Object.keys(colors)[0];
    expect(firstColorKey).toBeDefined();
    expect(resolveToken(`colors.${firstColorKey}`)).toBe(
      (colors as Record<string, unknown>)[firstColorKey],
    );
  });

  it('resolves a top-level token group', () => {
    expect(resolveToken('spacing')).toBe(spacing);
  });

  it('returns the fallback for unknown token paths', () => {
    expect(resolveToken('colors.does-not-exist', '#000')).toBe('#000');
    expect(resolveToken('nope.nope')).toBeUndefined();
  });

  it('returns undefined for empty or malformed paths', () => {
    expect(resolveToken('')).toBeUndefined();
    expect(resolveToken('colors..primary')).toBeUndefined();
  });

  it('getToken mirrors resolveToken behavior', () => {
    const firstSpacingKey = Object.keys(spacing)[0];
    expect(firstSpacingKey).toBeDefined();
    expect(getToken(`spacing.${firstSpacingKey}`)).toBe(
      (spacing as Record<string, unknown>)[firstSpacingKey],
    );
    expect(getToken('missing.path', 'fallback')).toBe('fallback');
  });

  it('isTokenPath validates known token paths', () => {
    const firstColorKey = Object.keys(colors)[0];
    expect(isTokenPath(`colors.${firstColorKey}`)).toBe(true);
    expect(isTokenPath('colors.does-not-exist')).toBe(false);
    expect(isTokenPath('')).toBe(false);
  });
});
