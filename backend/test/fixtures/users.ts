import { Keypair } from '@stellar/stellar-sdk';
import * as jwt from 'jsonwebtoken';

/**
 * Shared user and authentication test fixtures for backend integration testing.
 */

// Generate valid Stellar test keypairs
export const TEST_USER_KEYPAIR = Keypair.random();
export const SECONDARY_USER_KEYPAIR = Keypair.random();

export const TEST_USERS = {
  primary: {
    walletAddress: TEST_USER_KEYPAIR.publicKey(),
    secretKey: TEST_USER_KEYPAIR.secret(),
    role: 'MEMBER',
  },
  secondary: {
    walletAddress: SECONDARY_USER_KEYPAIR.publicKey(),
    secretKey: SECONDARY_USER_KEYPAIR.secret(),
    role: 'ADMIN',
  },
  invalid: {
    walletAddress: 'INVALID_STELLAR_ADDRESS_XYZ',
    secretKey: 'INVALID_SECRET_KEY',
  },
} as const;

/**
 * Generates an expired JWT token for integration testing error paths.
 */
export function createExpiredJwt(walletAddress: string, secret: string = 'test-jwt-secret-key-32-chars-long!'): string {
  return jwt.sign(
    { sub: walletAddress },
    secret,
    { expiresIn: '-1s' }
  );
}

/**
 * Generates an invalid signature for challenge verification tests.
 */
export function createInvalidSignature(): string {
  return Buffer.from('invalid-signature-bytes-payload').toString('base64');
}
