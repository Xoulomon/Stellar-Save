/**
 * Shared k6 configuration and performance thresholds for Stellar-Save.
 * Import this in individual test scenarios.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:5173';

/** Common thresholds applied to all scenarios */
export const commonThresholds = {
  // 95th-percentile response time under 500 ms
  http_req_duration: ['p(95)<500'],
  // Error rate below 1%
  http_req_failed: ['rate<0.01'],
};

/** Smoke test: 1 VU, 30 s — verify the system works at all */
export const smokeOptions = {
  vus: 1,
  duration: '30s',
  thresholds: commonThresholds,
};

/** Load test: ramp to 50 VUs over 1 min, hold 3 min, ramp down */
export const loadOptions = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ...commonThresholds,
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

/** Stress test: ramp to 200 VUs to find the breaking point */
export const stressOptions = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // allow up to 5% errors under stress
    http_req_duration: ['p(95)<2000'],
  },
};

/** Spike test: sudden burst of 300 VUs */
export const spikeOptions = {
  stages: [
    { duration: '10s', target: 300 },
    { duration: '1m', target: 300 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};
