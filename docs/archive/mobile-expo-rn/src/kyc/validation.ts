import type { KycSubmitFields } from './kycApi';

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof KycSubmitFields, string>>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;

/** Blocks malformed submissions client-side before they hit the backend. */
export function validateKycFields(fields: Partial<KycSubmitFields>): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (!fields.fullName || fields.fullName.trim().length < 2) {
    errors.fullName = 'Full name is required.';
  }
  if (!fields.dateOfBirth || !ISO_DATE.test(fields.dateOfBirth)) {
    errors.dateOfBirth = 'Date of birth must be in YYYY-MM-DD format.';
  }
  if (!fields.country || !ISO_COUNTRY.test(fields.country)) {
    errors.country = 'Country must be an ISO 3166-1 alpha-2 code.';
  }
  if (!fields.documentImageBase64 || fields.documentImageBase64.length === 0) {
    errors.documentImageBase64 = 'A captured ID document is required.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
