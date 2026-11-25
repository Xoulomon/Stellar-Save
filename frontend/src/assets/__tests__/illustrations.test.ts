import { describe, expect, it } from 'vitest';

import {
  errorIllustration,
  illustrations,
  notFoundIllustration,
} from '../illustrations';

describe('illustration registry', () => {
  it('exposes both illustrations from a single entry point', () => {
    expect(illustrations.error).toBe(errorIllustration);
    expect(illustrations.notFound).toBe(notFoundIllustration);
  });

  it('provides intrinsic dimensions to prevent layout shift', () => {
    for (const illustration of Object.values(illustrations)) {
      expect(illustration.src).toBeTruthy();
      expect(illustration.alt).toBeTruthy();
      expect(illustration.width).toBeGreaterThan(0);
      expect(illustration.height).toBeGreaterThan(0);
    }
  });

  it('provides a webp source for the error illustration', () => {
    expect(errorIllustration.sources).toEqual([
      { srcSet: expect.stringContaining('webp'), type: 'image/webp' },
    ]);
  });

  it('marks illustrations for lazy loading', () => {
    expect(errorIllustration.loading).toBe('lazy');
    expect(notFoundIllustration.loading).toBe('lazy');
  });
});
