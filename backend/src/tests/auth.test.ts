import { Keypair } from '@stellar/stellar-sdk';
import { generateChallenge, verifySignature, issueJwt, verifyJwt } from '../auth_service';
import * as redisClient from '../redis';

// Mock Redis so tests don't need a live Redis instance
jest.mock('../redis', () => {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : null;
    }),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

const mockRedis = redisClient as jest.Mocked<typeof redisClient> & { __store: Map<string, string> };

function clearStore() {
  mockRedis.__store.clear();
}

// Generate a real Stellar keypair for signing
const keypair = Keypair.random();
const walletAddress = keypair.publicKey();

function signMessage(message: string): string {
  return keypair.sign(Buffer.from(message, 'utf8')).toString('base64');
}

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
});

describe('generateChallenge', () => {
  it('returns a message containing the wallet address and a nonce', async () => {
    const challenge = await generateChallenge(walletAddress);
    expect(challenge).toContain(walletAddress);
    expect(challenge).toContain('Nonce:');
    expect(challenge).toContain('Timestamp:');
  });

  it('rejects an invalid Stellar address', async () => {
    await expect(generateChallenge('not-a-stellar-key')).rejects.toThrow(
      'Invalid Stellar wallet address'
    );
  });
});

describe('verifySignature', () => {
  it('returns true for a valid signature', async () => {
    const challenge = await generateChallenge(walletAddress);
    const signature = signMessage(challenge);
    const result = await verifySignature(walletAddress, challenge, signature);
    expect(result).toBe(true);
  });

  it('throws when no challenge exists (expired or never issued)', async () => {
    await expect(
      verifySignature(walletAddress, 'some message', 'c2lnbg==')
    ).rejects.toThrow('Challenge not found or expired');
  });

  it('throws on challenge message mismatch', async () => {
    await generateChallenge(walletAddress);
    await expect(
      verifySignature(walletAddress, 'tampered message', 'c2lnbg==')
    ).rejects.toThrow('Challenge message mismatch');
  });

  it('returns false for a signature from a different keypair', async () => {
    const challenge = await generateChallenge(walletAddress);
    const otherKeypair = Keypair.random();
    const wrongSignature = otherKeypair.sign(Buffer.from(challenge, 'utf8')).toString('base64');
    const result = await verifySignature(walletAddress, challenge, wrongSignature);
    expect(result).toBe(false);
  });

  it('consumes the challenge on a failed attempt (wrong signature)', async () => {
    const challenge = await generateChallenge(walletAddress);
    const wrongSignature = Keypair.random().sign(Buffer.from(challenge, 'utf8')).toString('base64');

    await verifySignature(walletAddress, challenge, wrongSignature);

    // Second attempt with the correct signature must fail — challenge is gone
    const correctSignature = signMessage(challenge);
    await expect(
      verifySignature(walletAddress, challenge, correctSignature)
    ).rejects.toThrow('Challenge not found or expired');
  });

  it('throws on replay of a used nonce', async () => {
    const challenge = await generateChallenge(walletAddress);
    const signature = signMessage(challenge);

    // First use succeeds
    const first = await verifySignature(walletAddress, challenge, signature);
    expect(first).toBe(true);

    // Manually re-insert the challenge to simulate a replay attempt
    // (in practice the challenge is gone, but we test the nonce guard directly)
    const nonce = challenge.match(/Nonce: ([a-f0-9]+)/)?.[1]!;
    const timestamp = parseInt(challenge.match(/Timestamp: (\d+)/)?.[1]!);
    const challengeKey = `auth:challenge:${walletAddress}`;
    mockRedis.__store.set(
      challengeKey,
      JSON.stringify({ nonce, message: challenge, timestamp })
    );

    await expect(
      verifySignature(walletAddress, challenge, signature)
    ).rejects.toThrow('Challenge nonce has already been used');
  });

  it('throws when the embedded timestamp is too old', async () => {
    const challenge = await generateChallenge(walletAddress);
    const signature = signMessage(challenge);

    // Backdate the stored timestamp by 6 minutes
    const nonce = challenge.match(/Nonce: ([a-f0-9]+)/)?.[1]!;
    const staleTimestamp = Date.now() - 6 * 60 * 1000;
    const challengeKey = `auth:challenge:${walletAddress}`;
    mockRedis.__store.set(
      challengeKey,
      JSON.stringify({ nonce, message: challenge, timestamp: staleTimestamp })
    );

    await expect(
      verifySignature(walletAddress, challenge, signature)
    ).rejects.toThrow('Challenge has expired');
  });
});

describe('issueJwt / verifyJwt', () => {
  it('issues a JWT that decodes to the wallet address', () => {
    const token = issueJwt(walletAddress);
    const payload = verifyJwt(token);
    expect(payload.sub).toBe(walletAddress);
  });
});
