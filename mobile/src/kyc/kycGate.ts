import type { KycStatus } from './kycApi';

/** Fiat ramp screens require a completed or clearly in-progress KYC status. */
export function canAccessFiatRamp(status: KycStatus | undefined): boolean {
  return status === 'pending' || status === 'approved';
}
