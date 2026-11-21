/**
 * Shared k6 configuration for Stellar-Save load tests.
 *
 * All load test files import BASE_URL and loadOptions from here so that
 * environment-specific settings are set in one place.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Default load options shared across standard endpoint tests.
 * Override per-file by exporting a custom `options` object instead.
 */
export const loadOptions = {
  stages: [
    { duration: '10s', target: 10 },  // ramp up
    { duration: '30s', target: 10 },  // hold
    { duration: '10s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1 % errors
    http_req_duration: ['p(95)<3000'],  // 95th pct < 3 s
  },
};
