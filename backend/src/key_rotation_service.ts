/**
 * key_rotation_service.ts
 *
 * Cryptographic key rotation for all signing keys (Issue #1171).
 *
 * Design
 * ──────
 * Keys are stored in a versioned in-memory registry backed by optional
 * environment-variable injection (production: use AWS Secrets Manager /
 * Vault — wire the loader in loadActiveKey below).
 *
 * Each key record has:
 *   - keyId      : opaque version string (UUID v4)
 *   - keyType    : jwt | hmac | api
 *   - material   : hex-encoded raw key bytes (never logged)
 *   - status     : active | retiring | retired
 *   - createdAt  : timestamp
 *   - expiresAt  : timestamp (rotation policy)
 *   - rotatedAt  : timestamp (set when a new key supersedes this one)
 *
 * Rotation procedure (zero-downtime)
 * ────────────────────────────────────
 * 1. Generate new key → status = active.
 * 2. Previous active key → status = retiring  (still validated, not used to sign).
 * 3. After `transitionWindowMs` old key → status = retired.
 *
 * Dual validation: tokens/payloads signed with any non-retired key are accepted,
 * so in-flight sessions survive across a rotation event.
 *
 * Audit logging: every rotation event is written to the append-only AuditEventLog.
 */

import crypto from 'crypto';
import { logger } from './logger';
import { AuditEventLog } from './audit_event_log';

// ── Types ─────────────────────────────────────────────────────────────────────

export type KeyType = 'jwt' | 'hmac' | 'api';
export type KeyStatus = 'active' | 'retiring' | 'retired';

export interface KeyRecord {
  keyId: string;
  keyType: KeyType;
  /** Hex-encoded raw bytes — never log this value. */
  material: string;
  status: KeyStatus;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
}

export interface RotationPolicy {
  keyType: KeyType;
  /** How often keys are rotated (ms). Default: 30 days. */
  rotationIntervalMs: number;
  /** How long a retiring key remains valid after rotation (ms). Default: 24 h. */
  transitionWindowMs: number;
  /** Key material byte length. */
  keyLengthBytes: number;
}

export interface RotationResult {
  previousKeyId: string;
  newKeyId: string;
  keyType: KeyType;
  rotatedAt: Date;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1_000;

const DEFAULT_POLICIES: Record<KeyType, RotationPolicy> = {
  jwt: {
    keyType: 'jwt',
    rotationIntervalMs: THIRTY_DAYS_MS,
    transitionWindowMs: TWENTY_FOUR_H_MS,
    keyLengthBytes: 64,
  },
  hmac: {
    keyType: 'hmac',
    rotationIntervalMs: THIRTY_DAYS_MS,
    transitionWindowMs: TWENTY_FOUR_H_MS,
    keyLengthBytes: 32,
  },
  api: {
    keyType: 'api',
    rotationIntervalMs: 90 * 24 * 60 * 60 * 1_000, // 90 days
    transitionWindowMs: 7 * 24 * 60 * 60 * 1_000,  // 7-day transition for API keys
    keyLengthBytes: 32,
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * In-process versioned key store.
 * In production, seed this from AWS Secrets Manager / HashiCorp Vault before
 * the server accepts traffic, then keep it warm with a background refresher.
 */
class KeyRegistry {
  /** keyType → ordered list (newest first) */
  private readonly keys = new Map<KeyType, KeyRecord[]>();
  private readonly policies = new Map<KeyType, RotationPolicy>(
    Object.entries(DEFAULT_POLICIES).map(([k, v]) => [k as KeyType, v]),
  );

  /**
   * Seed the registry with an initial key for each type.
   * Idempotent — skipped if the type already has an active key.
   */
  seedInitial(keyType: KeyType): KeyRecord {
    const existing = this.getActive(keyType);
    if (existing) return existing;
    return this._createKey(keyType);
  }

  getActive(keyType: KeyType): KeyRecord | undefined {
    return this.keys.get(keyType)?.find(k => k.status === 'active');
  }

  /** Return all keys that can be used for verification (active + retiring). */
  getValidating(keyType: KeyType): KeyRecord[] {
    return (this.keys.get(keyType) ?? []).filter(
      k => k.status === 'active' || k.status === 'retiring',
    );
  }

  getAll(keyType: KeyType): KeyRecord[] {
    return this.keys.get(keyType) ?? [];
  }

  getById(keyId: string): KeyRecord | undefined {
    for (const list of this.keys.values()) {
      const found = list.find(k => k.keyId === keyId);
      if (found) return found;
    }
    return undefined;
  }

  setPolicy(policy: RotationPolicy): void {
    this.policies.set(policy.keyType, policy);
  }

  getPolicy(keyType: KeyType): RotationPolicy {
    return this.policies.get(keyType) ?? DEFAULT_POLICIES[keyType];
  }

  /**
   * Rotate the active key for `keyType`:
   * 1. Move current active → retiring
   * 2. Create new active key
   * Returns both old and new KeyRecord.
   */
  rotate(keyType: KeyType): { previous: KeyRecord; current: KeyRecord } {
    const previous = this.getActive(keyType);
    if (!previous) {
      // Bootstrap — no previous key exists yet
      const current = this._createKey(keyType);
      return { previous: current, current };
    }

    previous.status = 'retiring';
    previous.rotatedAt = new Date();

    const current = this._createKey(keyType);
    return { previous, current };
  }

  /**
   * Retire keys whose transition window has elapsed.
   * Called periodically by the scheduler.
   */
  pruneRetiring(keyType: KeyType, nowMs = Date.now()): number {
    const policy = this.getPolicy(keyType);
    const list = this.keys.get(keyType) ?? [];
    let pruned = 0;
    for (const key of list) {
      if (
        key.status === 'retiring' &&
        key.rotatedAt &&
        nowMs - key.rotatedAt.getTime() > policy.transitionWindowMs
      ) {
        key.status = 'retired';
        pruned++;
      }
    }
    return pruned;
  }

  private _createKey(keyType: KeyType): KeyRecord {
    const policy = this.getPolicy(keyType);
    const record: KeyRecord = {
      keyId: crypto.randomUUID(),
      keyType,
      material: crypto.randomBytes(policy.keyLengthBytes).toString('hex'),
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + policy.rotationIntervalMs),
    };
    const list = this.keys.get(keyType) ?? [];
    list.unshift(record); // newest first
    this.keys.set(keyType, list);
    return record;
  }
}

export const keyRegistry = new KeyRegistry();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/** Ensure each key type has an initial active key at startup. */
export function bootstrapKeys(): void {
  for (const keyType of Object.keys(DEFAULT_POLICIES) as KeyType[]) {
    keyRegistry.seedInitial(keyType);
    logger.info('Key registry seeded', { keyType });
  }
}

// ── Rotation ──────────────────────────────────────────────────────────────────

/**
 * Rotate signing keys for the given type (or all types when omitted).
 * Emits an audit log entry for every rotation.
 */
export async function rotateKeys(keyType?: KeyType): Promise<RotationResult[]> {
  const types: KeyType[] = keyType
    ? [keyType]
    : (Object.keys(DEFAULT_POLICIES) as KeyType[]);

  const results: RotationResult[] = [];

  for (const type of types) {
    const { previous, current } = keyRegistry.rotate(type);
    const rotatedAt = current.createdAt;

    // Prune any keys whose transition window has elapsed
    keyRegistry.pruneRetiring(type);

    const result: RotationResult = {
      previousKeyId: previous.keyId,
      newKeyId: current.keyId,
      keyType: type,
      rotatedAt,
    };

    results.push(result);

    logger.info('Key rotated', {
      keyType: type,
      previousKeyId: previous.keyId,
      newKeyId: current.keyId,
    });

    // Audit log — never include key material
    await AuditEventLog.record({
      actor: 'system',
      action: 'key_rotation',
      resourceType: 'signing_key',
      resourceId: current.keyId,
      before: { keyId: previous.keyId, status: 'active' },
      after: {
        keyId: current.keyId,
        status: 'active',
        previousKeyId: previous.keyId,
        previousStatus: 'retiring',
      },
    });
  }

  return results;
}

// ── Dual-validation helpers ───────────────────────────────────────────────────

/**
 * Sign a payload with the current active key of the given type.
 * Returns { keyId, signature } — callers must store keyId alongside the signature
 * so the correct key can be selected during verification.
 */
export function signWithActiveKey(
  keyType: KeyType,
  data: string | Buffer,
): { keyId: string; signature: string } {
  const activeKey = keyRegistry.getActive(keyType);
  if (!activeKey) throw new Error(`No active key for type "${keyType}"`);

  const keyBuffer = Buffer.from(activeKey.material, 'hex');
  const signature = crypto
    .createHmac('sha256', keyBuffer)
    .update(data)
    .digest('hex');

  return { keyId: activeKey.keyId, signature };
}

/**
 * Verify a signature against ALL non-retired keys for the given type.
 * Returns the keyId whose key produced a valid signature, or null.
 *
 * Using timing-safe comparison to prevent timing attacks.
 */
export function verifyWithDualValidation(
  keyType: KeyType,
  data: string | Buffer,
  signature: string,
): { valid: boolean; keyId?: string; status?: KeyStatus } {
  const validatingKeys = keyRegistry.getValidating(keyType);

  for (const key of validatingKeys) {
    const keyBuffer = Buffer.from(key.material, 'hex');
    const expected = crypto
      .createHmac('sha256', keyBuffer)
      .update(data)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');

    if (
      expectedBuf.length === actualBuf.length &&
      crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return { valid: true, keyId: key.keyId, status: key.status };
    }
  }

  return { valid: false };
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let schedulerHandle: NodeJS.Timeout | null = null;

/**
 * Start the automatic rotation scheduler.
 * Checks every `checkIntervalMs` (default 1 hour) whether any key type
 * has exceeded its rotation policy interval and rotates if so.
 */
export function startRotationScheduler(checkIntervalMs = 60 * 60 * 1_000): void {
  if (schedulerHandle) return;

  schedulerHandle = setInterval(async () => {
    for (const keyType of Object.keys(DEFAULT_POLICIES) as KeyType[]) {
      const active = keyRegistry.getActive(keyType);
      if (!active) continue;

      const policy = keyRegistry.getPolicy(keyType);
      const ageMs = Date.now() - active.createdAt.getTime();

      if (ageMs >= policy.rotationIntervalMs) {
        logger.info('Scheduled key rotation triggered', { keyType, ageMs });
        await rotateKeys(keyType).catch(err =>
          logger.error('Scheduled key rotation failed', { keyType, err }),
        );
      }
    }
  }, checkIntervalMs);

  logger.info('Key rotation scheduler started', { checkIntervalMs });
}

export function stopRotationScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

// ── Status summary (admin endpoint) ──────────────────────────────────────────

export interface KeyStatusSummary {
  keyType: KeyType;
  keyId: string;
  status: KeyStatus;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
  ageMs: number;
  /** Days until the rotation policy interval elapses (may be negative). */
  daysUntilExpiry: number;
}

export function getKeyStatusSummary(): KeyStatusSummary[] {
  const now = Date.now();
  const summary: KeyStatusSummary[] = [];

  for (const keyType of Object.keys(DEFAULT_POLICIES) as KeyType[]) {
    for (const key of keyRegistry.getAll(keyType)) {
      const ageMs = now - key.createdAt.getTime();
      const daysUntilExpiry =
        (key.expiresAt.getTime() - now) / (24 * 60 * 60 * 1_000);

      summary.push({
        keyType: key.keyType,
        keyId: key.keyId,
        status: key.status,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        rotatedAt: key.rotatedAt,
        ageMs,
        daysUntilExpiry,
      });
    }
  }

  return summary;
}
