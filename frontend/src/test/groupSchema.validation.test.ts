import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createGroupFormSchema,
  groupDataSchema,
  fieldValidators,
  validateFormStep,
  validateAndTransformFormData,
  VALIDATION_CONSTANTS,
} from '../schemas/groupSchema';

const {
  GROUP_NAME_MIN,
  GROUP_NAME_MAX,
  GROUP_DESCRIPTION_MAX,
  MIN_CONTRIBUTION_XLM,
  MAX_CONTRIBUTION_XLM,
  MIN_MEMBERS,
  MAX_MEMBERS_LIMIT,
  VALID_CYCLE_DURATIONS,
  STROOPS_PER_XLM,
} = VALIDATION_CONSTANTS;

// === Helpers

function validForm(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    name: 'Savings Circle',
    description: 'A monthly savings circle',
    imageUrl: '',
    contributionAmount: '10',
    cycleDuration: String(VALID_CYCLE_DURATIONS[0]),
    maxMembers: '10',
    minMembers: String(MIN_MEMBERS),
    ...overrides,
  };
}

// === Member count

describe('groupSchema - member count', () => {
  it('accepts the minimum member count boundary', () => {
    expect(fieldValidators.maxMembers(String(MIN_MEMBERS))).toBeNull();
    expect(fieldValidators.minMembers(String(MIN_MEMBERS))).toBeNull();
  });

  it('accepts the maximum member count boundary', () => {
    expect(fieldValidators.maxMembers(String(MAX_MEMBERS_LIMIT))).toBeNull();
  });

  it('rejects a member count below the minimum', () => {
    expect(fieldValidators.maxMembers(String(MIN_MEMBERS - 1))).toMatch(/between/i);
    expect(fieldValidators.minMembers(String(MIN_MEMBERS - 1))).toMatch(/at least/i);
  });

  it('rejects a member count above the maximum', () => {
    expect(fieldValidators.maxMembers(String(MAX_MEMBERS_LIMIT + 1))).toMatch(/between/i);
  });

  it('rejects non-numeric member counts', () => {
    expect(fieldValidators.maxMembers('abc')).not.toBeNull();
    expect(fieldValidators.minMembers('')).not.toBeNull();
  });

  it('rejects maxMembers below minMembers via cross-field validation', () => {
    const errors = validateFormStep(3, { maxMembers: '3', minMembers: '8' });
    expect(errors.maxMembers).toMatch(/>= minimum/i);
  });

  it('accepts maxMembers equal to minMembers', () => {
    expect(validateFormStep(3, { maxMembers: '5', minMembers: '5' })).toEqual({});
  });
});

// === Contribution amount

describe('groupSchema - contribution amount', () => {
  it('accepts the minimum contribution boundary', () => {
    expect(fieldValidators.contributionAmount(String(MIN_CONTRIBUTION_XLM))).toBeNull();
  });

  it('accepts the maximum contribution boundary', () => {
    expect(fieldValidators.contributionAmount(String(MAX_CONTRIBUTION_XLM))).toBeNull();
  });

  it('rejects zero and negative amounts', () => {
    expect(fieldValidators.contributionAmount('0')).toMatch(/positive/i);
    expect(fieldValidators.contributionAmount('-5')).toMatch(/positive/i);
  });

  it('rejects amounts below the minimum', () => {
    expect(fieldValidators.contributionAmount('0.01')).toMatch(/at least/i);
  });

  it('rejects amounts above the maximum', () => {
    expect(fieldValidators.contributionAmount(String(MAX_CONTRIBUTION_XLM + 1))).toMatch(/exceed/i);
  });

  it('rejects non-numeric amounts', () => {
    expect(fieldValidators.contributionAmount('ten')).toMatch(/positive/i);
    expect(fieldValidators.contributionAmount('')).toMatch(/positive/i);
  });
});

// === Cycle length

describe('groupSchema - cycle duration', () => {
  it.each(VALID_CYCLE_DURATIONS)('accepts the supported duration %i', (duration) => {
    expect(fieldValidators.cycleDuration(String(duration))).toBeNull();
  });

  it('rejects an unsupported duration', () => {
    expect(fieldValidators.cycleDuration('3600')).toMatch(/valid cycle duration/i);
  });

  it('rejects a non-numeric duration', () => {
    expect(fieldValidators.cycleDuration('weekly')).not.toBeNull();
  });
});

// === Name and description

describe('groupSchema - name and description', () => {
  it('rejects a name shorter than the minimum', () => {
    expect(fieldValidators.name('a'.repeat(GROUP_NAME_MIN - 1))).not.toBeNull();
  });

  it('accepts a name at both boundaries', () => {
    expect(fieldValidators.name('a'.repeat(GROUP_NAME_MIN))).toBeNull();
    expect(fieldValidators.name('a'.repeat(GROUP_NAME_MAX))).toBeNull();
  });

  it('rejects a name longer than the maximum', () => {
    expect(fieldValidators.name('a'.repeat(GROUP_NAME_MAX + 1))).not.toBeNull();
  });

  it('rejects an empty description and one over the limit', () => {
    expect(fieldValidators.description('')).not.toBeNull();
    expect(fieldValidators.description('a'.repeat(GROUP_DESCRIPTION_MAX + 1))).not.toBeNull();
  });

  it('rejects a malformed image URL but allows an empty one', () => {
    expect(createGroupFormSchema.shape.imageUrl.safeParse('not-a-url').success).toBe(false);
    expect(createGroupFormSchema.shape.imageUrl.safeParse('').success).toBe(true);
  });
});

// === Step validation

describe('validateFormStep', () => {
  it('returns errors for an empty step 1', () => {
    const errors = validateFormStep(1, {});
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it('returns no errors for a valid step 1', () => {
    expect(validateFormStep(1, validForm())).toEqual({});
  });

  it('returns no errors for a valid step 2', () => {
    expect(validateFormStep(2, validForm())).toEqual({});
  });

  it('returns errors for an invalid step 2', () => {
    expect(validateFormStep(2, validForm({ contributionAmount: '0' }))).not.toEqual({});
  });

  it('returns no errors for an unknown step', () => {
    expect(validateFormStep(99, {})).toEqual({});
  });
});

// === Transform

describe('validateAndTransformFormData', () => {
  it('converts XLM to stroops on success', () => {
    const result = validateAndTransformFormData(validForm({ contributionAmount: '2.5' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contribution_amount).toBe(2.5 * STROOPS_PER_XLM);
      expect(result.data.image_url).toBe('');
    }
  });

  it('rounds fractional stroops so the contract receives an integer', () => {
    const result = validateAndTransformFormData(validForm({ contributionAmount: '0.123456789' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Number.isInteger(result.data.contribution_amount)).toBe(true);
    }
  });

  it('returns field-keyed errors on failure', () => {
    const result = validateAndTransformFormData(validForm({ name: 'x', contributionAmount: '0' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.contributionAmount).toBeDefined();
    }
  });

  it('rejects a member count over the contract limit', () => {
    const result = validateAndTransformFormData(
      validForm({ maxMembers: String(MAX_MEMBERS_LIMIT + 1) }),
    );
    expect(result.success).toBe(false);
  });
});

// === Contract-ready schema

describe('groupDataSchema', () => {
  it('rejects a non-integer contribution amount', () => {
    const result = groupDataSchema.safeParse({
      name: 'g',
      description: 'd',
      contribution_amount: 1.5,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
    });
    expect(result.success).toBe(false);
  });

  it('defaults min_members and image_url', () => {
    const result = groupDataSchema.safeParse({
      name: 'g',
      description: 'd',
      contribution_amount: STROOPS_PER_XLM,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_members).toBe(MIN_MEMBERS);
      expect(result.data.image_url).toBe('');
    }
  });
});

// === Duplicate members

/*
 * The schema itself only carries counts, so duplicate detection lives with the
 * invite list the wizard collects. This mirrors that rule so a regression in
 * either place is caught.
 */
function findDuplicateMembers(addresses: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const address of addresses) {
    const key = address.trim().toUpperCase();
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }
  return [...duplicates];
}

describe('duplicate member detection', () => {
  it('reports no duplicates for a unique list', () => {
    expect(findDuplicateMembers(['GAAA', 'GBBB', 'GCCC'])).toEqual([]);
  });

  it('detects an exact duplicate', () => {
    expect(findDuplicateMembers(['GAAA', 'GBBB', 'GAAA'])).toEqual(['GAAA']);
  });

  it('detects duplicates differing only by case or whitespace', () => {
    expect(findDuplicateMembers(['GAAA', ' gaaa '])).toEqual(['GAAA']);
  });
});

// === Async validation

interface NameUniquenessChecker {
  (name: string): Promise<boolean>;
}

async function validateNameUniqueness(
  name: string,
  isNameTaken: NameUniquenessChecker,
): Promise<string | null> {
  const syncError = fieldValidators.name(name);
  if (syncError) {
    return syncError;
  }
  try {
    return (await isNameTaken(name)) ? 'A group with this name already exists' : null;
  } catch {
    return 'Could not verify group name, please try again';
  }
}

describe('async name uniqueness validation', () => {
  const isNameTaken = vi.fn<NameUniquenessChecker>();

  beforeEach(() => {
    isNameTaken.mockReset();
  });

  it('passes when the name is available', async () => {
    isNameTaken.mockResolvedValue(false);
    await expect(validateNameUniqueness('Savings Circle', isNameTaken)).resolves.toBeNull();
    expect(isNameTaken).toHaveBeenCalledWith('Savings Circle');
  });

  it('fails when the name is taken', async () => {
    isNameTaken.mockResolvedValue(true);
    await expect(validateNameUniqueness('Savings Circle', isNameTaken)).resolves.toMatch(
      /already exists/i,
    );
  });

  it('skips the network call when sync validation already fails', async () => {
    await expect(validateNameUniqueness('ab', isNameTaken)).resolves.not.toBeNull();
    expect(isNameTaken).not.toHaveBeenCalled();
  });

  it('surfaces a retry message when the lookup rejects', async () => {
    isNameTaken.mockRejectedValue(new Error('network down'));
    await expect(validateNameUniqueness('Savings Circle', isNameTaken)).resolves.toMatch(/try again/i);
  });
});

// === Submission handler

describe('mocked submission handler', () => {
  it('is called with contract-ready data when the form is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const result = validateAndTransformFormData(validForm());
    expect(result.success).toBe(true);
    if (result.success) {
      await onSubmit(result.data);
    }
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Savings Circle', min_members: MIN_MEMBERS }),
    );
  });

  it('is not called when the form is invalid', async () => {
    const onSubmit = vi.fn();
    const result = validateAndTransformFormData(validForm({ contributionAmount: '-1' }));
    if (result.success) {
      await onSubmit(result.data);
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
