/**
 * recoverySchema.test.ts
 *
 * Unit coverage for the guardian setup rules, which previously lived inline in
 * `pages/RecoverySetupPage.tsx`.
 */
import { describe, it, expect } from 'vitest';

import {
  RECOVERY_MESSAGES,
  STELLAR_ADDRESS_REGEX,
  guardianAddressSchema,
  validateGuardianAddress,
  validateThreshold,
} from '../schemas/recoverySchema';

const OWNER = `G${'A'.repeat(55)}`;
const GUARDIAN_A = `G${'B'.repeat(55)}`;
const GUARDIAN_B = `G${'C'.repeat(55)}`;

const context = { ownerAddress: OWNER, guardians: [] as string[] };

describe('STELLAR_ADDRESS_REGEX', () => {
  it('accepts a base32 Stellar address', () => {
    expect(STELLAR_ADDRESS_REGEX.test(GUARDIAN_A)).toBe(true);
  });

  it('rejects digits outside the base32 alphabet (0, 1, 8, 9)', () => {
    for (const bad of ['0', '1', '8', '9']) {
      const address = `G${bad.repeat(55)}`;
      expect(STELLAR_ADDRESS_REGEX.test(address), `should reject ${bad}`).toBe(false);
    }
  });

  it('rejects a lowercase address', () => {
    expect(STELLAR_ADDRESS_REGEX.test(GUARDIAN_A.toLowerCase())).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(STELLAR_ADDRESS_REGEX.test(`G${'A'.repeat(54)}`)).toBe(false);
    expect(STELLAR_ADDRESS_REGEX.test(`G${'A'.repeat(56)}`)).toBe(false);
  });
});

describe('guardianAddressSchema', () => {
  it('trims surrounding whitespace before validating', () => {
    expect(guardianAddressSchema.safeParse(`  ${GUARDIAN_A}  `).success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(guardianAddressSchema.safeParse('').success).toBe(false);
  });
});

describe('validateGuardianAddress', () => {
  it('accepts a new, valid, non-owner address', () => {
    expect(validateGuardianAddress(GUARDIAN_A, context)).toBeNull();
  });

  it('rejects a malformed address', () => {
    expect(validateGuardianAddress('not-an-address', context)).toBe(
      RECOVERY_MESSAGES.invalidAddress
    );
  });

  it('rejects an empty value', () => {
    expect(validateGuardianAddress('', context)).toBe(RECOVERY_MESSAGES.invalidAddress);
  });

  it("rejects the owner's own address", () => {
    expect(validateGuardianAddress(OWNER, context)).toBe(RECOVERY_MESSAGES.selfGuardian);
  });

  it('rejects an address that is already a guardian', () => {
    expect(
      validateGuardianAddress(GUARDIAN_A, { ownerAddress: OWNER, guardians: [GUARDIAN_A] })
    ).toBe(RECOVERY_MESSAGES.duplicateGuardian);
  });

  it('matches the trimmed address when checking duplicates', () => {
    expect(
      validateGuardianAddress(`  ${GUARDIAN_A}  `, {
        ownerAddress: OWNER,
        guardians: [GUARDIAN_A],
      })
    ).toBe(RECOVERY_MESSAGES.duplicateGuardian);
  });

  it('checks the shape before the self-reference rule', () => {
    // A malformed owner address should surface the shape error, not "self".
    expect(validateGuardianAddress('nope', { ownerAddress: 'nope', guardians: [] })).toBe(
      RECOVERY_MESSAGES.invalidAddress
    );
  });

  it('allows a second distinct guardian', () => {
    expect(
      validateGuardianAddress(GUARDIAN_B, { ownerAddress: OWNER, guardians: [GUARDIAN_A] })
    ).toBeNull();
  });
});

describe('validateThreshold', () => {
  it('accepts a threshold equal to the guardian count', () => {
    expect(validateThreshold(3, 3)).toBeNull();
  });

  it('accepts a threshold below the guardian count', () => {
    expect(validateThreshold(1, 3)).toBeNull();
  });

  it('rejects a threshold above the guardian count', () => {
    expect(validateThreshold(4, 3)).toBe('Threshold (4) cannot exceed number of guardians (3).');
  });

  it('does not report an error when there are no guardians', () => {
    expect(validateThreshold(1, 0)).toBeNull();
  });
});
