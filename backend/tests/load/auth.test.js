/**
 * k6 load test — Auth API endpoint
 *
 * Simulates concurrent users requesting auth challenges and verifying signatures.
 *
 * Run:
 *   k6 run backend/tests/load/auth.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../../tests/load/config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const challengeDuration = new Trend('challenge_duration', true);
const verifyDuration = new Trend('verify_duration', true);
const errorRate = new Rate('auth_errors');

// ── Options ───────────────────────────────────────────────────────────────────
export const options = loadOptions;

const HEADERS = { 'Content-Type': 'application/json' };

function randomStellarAddress() {
  // Generate a valid-looking Stellar address for testing
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let addr = 'G';
  for (let i = 0; i < 55; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

// ── Test scenarios ────────────────────────────────────────────────────────────
export default function () {
  const walletAddress = randomStellarAddress();

  group('request challenge', () => {
    const payload = JSON.stringify({ walletAddress });
    const res = http.post(`${BASE_URL}/api/auth/challenge`, payload, { headers: HEADERS });
    challengeDuration.add(res.timings.duration);
    
    const ok = check(res, {
      'challenge status 200': (r) => r.status === 200,
      'challenge has challenge field': (r) => r.json('challenge') !== undefined,
      'challenge is string': (r) => typeof r.json('challenge') === 'string',
    });
    errorRate.add(!ok);

    // Store challenge for verify test
    if (res.status === 200) {
      const challenge = res.json('challenge');
      
      sleep(0.5);

      group('verify signature (invalid)', () => {
        // Test with invalid signature to check error handling
        const verifyPayload = JSON.stringify({
          walletAddress,
          challenge,
          signature: 'invalid_signature_' + Math.random().toString(36),
        });
        const verifyRes = http.post(`${BASE_URL}/api/auth/verify`, verifyPayload, { headers: HEADERS });
        verifyDuration.add(verifyRes.timings.duration);
        
        const verifyOk = check(verifyRes, {
          'verify status 401': (r) => r.status === 401,
          'verify error message': (r) => r.json('error') !== undefined,
        });
        errorRate.add(!verifyOk);
      });
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'backend/tests/load/results/auth-summary.json': JSON.stringify(data, null, 2),
  };
}
