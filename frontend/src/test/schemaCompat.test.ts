/**
 * Schema Compatibility Test — frontend groupDataSchema vs backend schemas.createGroup
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE
 * ─────────────────────────────────────────────────────────────────────────────
 * The frontend (frontend/src/schemas/groupSchema.ts :: groupDataSchema) and the
 * backend (backend/src/lib/validation.ts :: schemas.createGroup) each define
 * validation rules for group-creation data.  They intentionally exist at
 * different layers of the system, so a 1:1 shape match is neither possible nor
 * desirable.  This file:
 *
 *   1. Documents every known field difference and classifies it as INTENTIONAL
 *      or ACCIDENTAL DRIFT.
 *   2. Asserts the rules that MUST stay in sync so that regressions are caught
 *      automatically.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIELD-BY-FIELD DIFFERENCES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. NAMING CONVENTION — INTENTIONAL
 *    Frontend groupDataSchema uses snake_case for all fields because it is the
 *    contract-ready format (Soroban / Rust convention).  The backend
 *    schemas.createGroup uses camelCase because it validates HTTP request bodies
 *    following REST/JSON convention.  Mapping between the two is the
 *    responsibility of the API client layer (src/api/groupApi.ts).
 *
 * 2. contribution_amount (frontend) vs contributionAmount (backend) — INTENTIONAL
 *    Unit difference: frontend stores the value as an integer number of stroops
 *    (1 XLM = 10,000,000 stroops) because that is what the Soroban contract
 *    expects.  The backend receives the amount in XLM as a floating-point
 *    number and performs its own validation/conversion.  The two schemas
 *    therefore have different numeric ranges and types by design.
 *
 * 3. min_members (frontend only) — INTENTIONAL
 *    The backend createGroup endpoint does not currently enforce a minimum
 *    member count at the API boundary; that constraint is enforced by the
 *    smart contract.  The frontend validates it eagerly for a better user
 *    experience.
 *
 * 4. image_url (frontend only) — INTENTIONAL
 *    The group creation API endpoint does not accept an image URL today; images
 *    are uploaded separately via the IPFS pinning service.  The frontend
 *    validates the field so the wizard UI can give immediate feedback, but the
 *    value is not included in the body sent to POST /v1/groups.
 *
 * 5. insuranceEnabled / insurancePremiumRate (frontend only) — ⚠️  ACCIDENTAL DRIFT
 *    These fields were added to the frontend as part of Issue #1012 (insurance
 *    pool MVP) but the corresponding backend validation has not been added yet.
 *    Tracked in: https://github.com/Xoulomon/Stellar-Save/issues/1012
 *    Action required: once the backend endpoint accepts these fields, add them
 *    to schemas.createGroup and update the assertions below.
 *
 * 6. name max length — ⚠️  ACCIDENTAL DRIFT (frontend is stricter)
 *    Frontend: max 50 characters.
 *    Backend:  max 100 characters.
 *    The frontend is more restrictive than the API permits, so no valid
 *    frontend submission will be rejected by the backend.  The limits should
 *    be harmonised; the backend should be tightened to 50 so that the API
 *    contract is self-documenting.  Tracked as a follow-up cleanup.
 *
 * 7. description required vs optional — ⚠️  ACCIDENTAL DRIFT
 *    Frontend: description is required (min 1 character).
 *    Backend:  description is optional (absent = no validation).
 *    The frontend is again stricter, so no valid frontend submission will fail
 *    the backend.  However, the backend silently allows creation of description-
 *    less groups via direct API calls.  Should be aligned to required on both
 *    sides.
 *
 * 8. cycleDuration allowed values — INTENTIONAL (frontend is stricter)
 *    Frontend validates cycleDuration against an explicit allowlist
 *    [604800, 1209600, 2592000] (1 week / 2 weeks / 1 month in seconds).
 *    Backend only checks that the value is a positive integer, relying on the
 *    smart contract to enforce allowed values.  The frontend provides early
 *    rejection for a better UX.
 *
 * 9. maxMembers range (2–20) — ✅  IN SYNC
 *    Both frontend and backend agree on min 2, max 20.  The MAX_MEMBERS_LIMIT
 *    constant in groupSchema.ts carries a comment explicitly linking it to the
 *    backend memberCount schema cap so that future changes stay coordinated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IF A TEST BELOW FAILS
 * ─────────────────────────────────────────────────────────────────────────────
 *   • A "should agree" assertion failing means someone changed one side but
 *     not the other.  Update BOTH schemas and this comment block together.
 *   • An "intentional boundary" assertion failing means a hard constraint was
 *     relaxed unexpectedly.  Review the change carefully before widening the
 *     assertion.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  groupDataSchema,
  createGroupFormSchema,
  VALIDATION_CONSTANTS,
} from '../schemas/groupSchema';

const {
  GROUP_NAME_MAX,
  MIN_MEMBERS,
  MAX_MEMBERS_LIMIT,
  VALID_CYCLE_DURATIONS,
  STROOPS_PER_XLM,
  MIN_CONTRIBUTION_XLM,
  MAX_CONTRIBUTION_XLM,
} = VALIDATION_CONSTANTS;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum valid contract-ready payload accepted by groupDataSchema. */
function validContractPayload(
  overrides: Partial<z.infer<typeof groupDataSchema>> = {},
): z.infer<typeof groupDataSchema> {
  return {
    name: 'Savings Circle',
    description: 'A monthly savings circle',
    image_url: '',
    contribution_amount: STROOPS_PER_XLM, // 1 XLM in stroops
    cycle_duration: VALID_CYCLE_DURATIONS[0], // 1 week
    max_members: 10,
    min_members: MIN_MEMBERS,
    insuranceEnabled: false,
    insurancePremiumRate: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. maxMembers — must stay in sync with backend memberCount schema
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: maxMembers range must match backend memberCount (2–20)', () => {
  it('frontend groupDataSchema accepts the backend minimum boundary (2)', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ max_members: 2, min_members: 2 }));
    expect(result.success).toBe(true);
  });

  it('frontend groupDataSchema accepts the backend maximum boundary (20)', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ max_members: 20 }));
    expect(result.success).toBe(true);
  });

  it('frontend groupDataSchema rejects max_members = 1 (below backend minimum)', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ max_members: 1, min_members: 1 }));
    expect(result.success).toBe(false);
  });

  it('frontend groupDataSchema rejects max_members = 21 (above backend maximum)', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ max_members: 21 }));
    expect(result.success).toBe(false);
  });

  it('MAX_MEMBERS_LIMIT constant equals the backend cap of 20', () => {
    // If the backend memberCount schema changes its .max(), update this constant
    // AND the backend schema together, then adjust this test.
    expect(MAX_MEMBERS_LIMIT).toBe(20);
  });

  it('MIN_MEMBERS constant equals the backend minimum of 2', () => {
    expect(MIN_MEMBERS).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. name max length — frontend is stricter (50) than backend (100)
//    Frontend must never allow a value that would fail at the backend, so the
//    frontend cap must be ≤ the backend cap.
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: name length — frontend must be no looser than backend (≤100)', () => {
  const BACKEND_NAME_MAX = 100;

  it('frontend form schema rejects names longer than GROUP_NAME_MAX (50)', () => {
    const longName = 'a'.repeat(GROUP_NAME_MAX + 1);
    const result = createGroupFormSchema.shape.name.safeParse(longName);
    expect(result.success).toBe(false);
  });

  it('frontend cap (50) does not exceed the backend cap (100)', () => {
    // This assertion documents the intentional strictness gap.
    // If the backend tightens to 50 in the future, both this value and the
    // backend schema must be updated together.
    expect(GROUP_NAME_MAX).toBeLessThanOrEqual(BACKEND_NAME_MAX);
  });

  it('groupDataSchema name field has min length 1', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ name: '' }));
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. description required vs optional — frontend requires, backend allows absent
//    Frontend must never submit an empty description that could sneak through
//    to a future stricter backend.
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: description — frontend is stricter (required) than backend (optional)', () => {
  it('frontend form schema rejects an empty description', () => {
    const result = createGroupFormSchema.shape.description.safeParse('');
    expect(result.success).toBe(false);
  });

  it('frontend groupDataSchema rejects an empty description', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ description: '' }));
    expect(result.success).toBe(false);
  });

  it('frontend groupDataSchema accepts a non-empty description', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ description: 'A valid description' }),
    );
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. contribution_amount — stroops (frontend) vs XLM amount (backend)
//    The frontend converts to stroops before submitting to the contract.
//    The assertions here protect the conversion constant and the int constraint.
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: contribution_amount — stroops conversion boundary', () => {
  it('STROOPS_PER_XLM is exactly 10,000,000', () => {
    // Stellar's base unit is fixed.  If this ever changes the whole conversion
    // logic must be reviewed.
    expect(STROOPS_PER_XLM).toBe(10_000_000);
  });

  it('groupDataSchema rejects a fractional (non-integer) stroop amount', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ contribution_amount: 1.5 }),
    );
    expect(result.success).toBe(false);
  });

  it('groupDataSchema rejects zero', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ contribution_amount: 0 }),
    );
    expect(result.success).toBe(false);
  });

  it('groupDataSchema rejects a negative stroop amount', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ contribution_amount: -1 }),
    );
    expect(result.success).toBe(false);
  });

  it('frontend form MIN_CONTRIBUTION_XLM converts to a valid stroop count', () => {
    const stroops = Math.round(MIN_CONTRIBUTION_XLM * STROOPS_PER_XLM);
    const result = groupDataSchema.safeParse(
      validContractPayload({ contribution_amount: stroops }),
    );
    expect(result.success).toBe(true);
  });

  it('frontend form MAX_CONTRIBUTION_XLM converts to a valid stroop count', () => {
    const stroops = MAX_CONTRIBUTION_XLM * STROOPS_PER_XLM;
    const result = groupDataSchema.safeParse(
      validContractPayload({ contribution_amount: stroops }),
    );
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. cycleDuration — frontend is stricter (allowlist) than backend (positive int)
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: cycleDuration — frontend allowlist is a strict subset of backend positiveInt', () => {
  it.each(VALID_CYCLE_DURATIONS)(
    'frontend groupDataSchema accepts supported duration %i seconds',
    (duration) => {
      const result = groupDataSchema.safeParse(
        validContractPayload({ cycle_duration: duration }),
      );
      expect(result.success).toBe(true);
    },
  );

  it('frontend groupDataSchema rejects an arbitrary positive duration not in the allowlist', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ cycle_duration: 3600 }), // 1 hour — not supported
    );
    expect(result.success).toBe(false);
  });

  it('frontend groupDataSchema rejects zero and negative durations', () => {
    expect(
      groupDataSchema.safeParse(validContractPayload({ cycle_duration: 0 })).success,
    ).toBe(false);
    expect(
      groupDataSchema.safeParse(validContractPayload({ cycle_duration: -604800 })).success,
    ).toBe(false);
  });

  it('VALID_CYCLE_DURATIONS contains exactly 3 entries (1w / 2w / 1m)', () => {
    // Guards against accidentally removing a duration without updating docs.
    expect(VALID_CYCLE_DURATIONS).toHaveLength(3);
    expect(VALID_CYCLE_DURATIONS).toContain(604800);   // 1 week
    expect(VALID_CYCLE_DURATIONS).toContain(1209600);  // 2 weeks
    expect(VALID_CYCLE_DURATIONS).toContain(2592000);  // 1 month
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. insuranceEnabled / insurancePremiumRate — ⚠️  ACCIDENTAL DRIFT (Issue #1012)
//    These fields are frontend-only until the backend adds them.
//    The tests here document their current shape so changes to the defaults
//    or range are caught before the backend implementation lands.
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: insurance fields — frontend-only until Issue #1012 lands', () => {
  it('insuranceEnabled defaults to false', () => {
    // Omit insuranceEnabled from the payload to exercise the default.
    const payload = {
      name: 'Savings Circle',
      description: 'A monthly savings circle',
      image_url: '',
      contribution_amount: STROOPS_PER_XLM,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
      min_members: MIN_MEMBERS,
      insurancePremiumRate: 0,
    };
    const result = groupDataSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.insuranceEnabled).toBe(false);
    }
  });

  it('insurancePremiumRate is clamped to 0–100', () => {
    expect(
      groupDataSchema.safeParse(validContractPayload({ insurancePremiumRate: -1 })).success,
    ).toBe(false);
    expect(
      groupDataSchema.safeParse(validContractPayload({ insurancePremiumRate: 101 })).success,
    ).toBe(false);
    expect(
      groupDataSchema.safeParse(validContractPayload({ insurancePremiumRate: 0 })).success,
    ).toBe(true);
    expect(
      groupDataSchema.safeParse(validContractPayload({ insurancePremiumRate: 100 })).success,
    ).toBe(true);
  });

  it('insurancePremiumRate defaults to 5 when omitted', () => {
    const payload = {
      name: 'Savings Circle',
      description: 'A monthly savings circle',
      image_url: '',
      contribution_amount: STROOPS_PER_XLM,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
      min_members: MIN_MEMBERS,
      insuranceEnabled: true,
    };
    const result = groupDataSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.insurancePremiumRate).toBe(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 & 4. min_members and image_url — frontend-only fields
// ─────────────────────────────────────────────────────────────────────────────

describe('schemaCompat: min_members — frontend-only, contract-enforced on-chain', () => {
  it('groupDataSchema rejects min_members below 2', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ min_members: 1 }),
    );
    expect(result.success).toBe(false);
  });

  it('groupDataSchema accepts min_members at the boundary (2)', () => {
    const result = groupDataSchema.safeParse(
      validContractPayload({ min_members: 2 }),
    );
    expect(result.success).toBe(true);
  });

  it('groupDataSchema defaults min_members to MIN_MEMBERS (2) when omitted', () => {
    const payload: Record<string, unknown> = {
      name: 'Savings Circle',
      description: 'A monthly savings circle',
      image_url: '',
      contribution_amount: STROOPS_PER_XLM,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
      insuranceEnabled: false,
      insurancePremiumRate: 0,
    };
    const result = groupDataSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_members).toBe(MIN_MEMBERS);
    }
  });
});

describe('schemaCompat: image_url — frontend-only, validated for UX before IPFS upload', () => {
  it('groupDataSchema accepts an empty image_url (no image)', () => {
    const result = groupDataSchema.safeParse(validContractPayload({ image_url: '' }));
    expect(result.success).toBe(true);
  });

  it('groupDataSchema defaults image_url to empty string when omitted', () => {
    const payload: Record<string, unknown> = {
      name: 'Savings Circle',
      description: 'A monthly savings circle',
      contribution_amount: STROOPS_PER_XLM,
      cycle_duration: VALID_CYCLE_DURATIONS[0],
      max_members: 5,
      min_members: MIN_MEMBERS,
      insuranceEnabled: false,
      insurancePremiumRate: 0,
    };
    const result = groupDataSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image_url).toBe('');
    }
  });
});
