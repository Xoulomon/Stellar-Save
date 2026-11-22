import { formatDate } from '@stellar-save/sdk';

import { formatDateRelative, formatDateAbsolute } from '../utils/formatDate';

// A fixed date far enough in the past that the SDK's relative formatter
// always falls into its time-independent "year" fallback branch, so these
// assertions don't depend on when the test happens to run.
const OLD_DATE = new Date('2020-01-15T15:45:00Z');

describe('formatDateRelative', () => {
  it('forwards to the SDK with mode: relative', () => {
    expect(formatDateRelative(OLD_DATE)).toBe(formatDate(OLD_DATE, { mode: 'relative' }));
  });

  it('merges through additional options such as locale', () => {
    expect(formatDateRelative(OLD_DATE, { locale: 'en-GB' })).toBe(
      formatDate(OLD_DATE, { mode: 'relative', locale: 'en-GB' })
    );
  });
});

describe('formatDateAbsolute', () => {
  it('forwards to the SDK with mode: absolute', () => {
    expect(formatDateAbsolute(OLD_DATE)).toBe(formatDate(OLD_DATE, { mode: 'absolute' }));
  });

  it('merges through additional options such as locale', () => {
    expect(formatDateAbsolute(OLD_DATE, { locale: 'en-GB' })).toBe(
      formatDate(OLD_DATE, { mode: 'absolute', locale: 'en-GB' })
    );
  });
});
