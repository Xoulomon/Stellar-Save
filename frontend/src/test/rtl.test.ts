import { RTL_LANGUAGES, isRTL, getDir } from '../utils/rtl';

describe('isRTL', () => {
  it.each([
    ['ar', true],
    ['fa', true],
    ['en', false],
    ['', false],
    ['AR', false], // case-sensitive
  ])('isRTL(%p) -> %p', (lang, expected) => {
    expect(isRTL(lang)).toBe(expected);
  });

  it('matches every language in RTL_LANGUAGES', () => {
    for (const lang of RTL_LANGUAGES) {
      expect(isRTL(lang)).toBe(true);
    }
  });
});

describe('getDir', () => {
  it.each([
    ['ar', 'rtl'],
    ['fa', 'rtl'],
    ['en', 'ltr'],
    ['', 'ltr'],
  ])('getDir(%p) -> %p', (lang, expected) => {
    expect(getDir(lang)).toBe(expected);
  });
});
