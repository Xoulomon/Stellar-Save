export const MAESTRO_TEST_MODE =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  typeof process !== 'undefined' &&
  process.env?.EXPO_PUBLIC_MAESTRO_TESTING === 'true';
