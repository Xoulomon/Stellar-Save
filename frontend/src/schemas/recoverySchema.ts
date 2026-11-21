/**
 * recoverySchema.ts — social recovery form validation.
 *
 * The guardian setup form previously validated inline inside
 * `pages/RecoverySetupPage.tsx`, with three hardcoded error strings and a
 * fourth cross-field rule for the approval threshold. The rules now live here
 * so they can be unit tested and reused.
 *
 * ## Address pattern
 *
 * Stellar addresses are base32, so the alphabet is `A-Z2-7` — digits `0`, `1`,
 * `8` and `9` are not valid. Note this is intentionally *stricter* than
 * `lib/validation.ts`'s `STELLAR_ADDRESS_REGEX` (`A-Z0-9`), which is a
 * separate, more permissive pattern used by the group schema. Reconciling the
 * two is tracked separately; this file preserves the behaviour the recovery
 * form has always had rather than silently widening it.
 */
import { z } from 'zod';

/** Canonical Stellar address shape: `G` + 55 base32 characters. */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/** A single guardian address field. */
export const guardianAddressSchema = z
  .string()
  .trim()
  .regex(STELLAR_ADDRESS_REGEX, 'Enter a valid Stellar address (starts with G, 56 chars).');

/** Messages for the guardian input, kept identical to the previous inline copy. */
export const RECOVERY_MESSAGES = {
  invalidAddress: 'Enter a valid Stellar address (starts with G, 56 chars).',
  selfGuardian: 'You cannot add your own address as a guardian.',
  duplicateGuardian: 'This address is already a guardian.',
} as const;

export interface GuardianAddressContext {
  /** Address of the account being protected — cannot also be its guardian. */
  ownerAddress: string;
  /** Guardians already configured. */
  guardians: string[];
}

/**
 * Validate a guardian address against the form's three rules, in order:
 * shape, self-reference, then duplication.
 *
 * @returns The error message, or `null` when the address may be added.
 */
export function validateGuardianAddress(
  raw: string,
  { ownerAddress, guardians }: GuardianAddressContext
): string | null {
  const address = raw.trim();

  if (!guardianAddressSchema.safeParse(address).success) {
    return RECOVERY_MESSAGES.invalidAddress;
  }

  if (address === ownerAddress) {
    return RECOVERY_MESSAGES.selfGuardian;
  }

  if (guardians.includes(address)) {
    return RECOVERY_MESSAGES.duplicateGuardian;
  }

  return null;
}

/**
 * Cross-field rule: the approval threshold cannot exceed the guardian count.
 *
 * @returns The error message, or `null` when the threshold is reachable.
 */
export function validateThreshold(threshold: number, guardianCount: number): string | null {
  if (guardianCount > 0 && threshold > guardianCount) {
    return `Threshold (${threshold}) cannot exceed number of guardians (${guardianCount}).`;
  }
  return null;
}
