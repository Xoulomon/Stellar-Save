/**
 * Re-exports from the shared @stellar-save/sdk package.
 * Existing imports of this module continue to work unchanged.
 */
export {
  validateAddress,
  isValidStellarAddress,
} from '@stellar-save/sdk';
export type { ValidateAddressResult } from '@stellar-save/sdk';

// Predefined test addresses (kept here for test convenience)
export const VALID_STELLAR_ADDRESS =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q';
export const INVALID_CHECKSUM_ADDRESS =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABB';
export const INVALID_FORMAT_ADDRESS = 'NotAStellarAddress';
