import * as SecureStore from 'expo-secure-store';

const SECRET_KEY_STORAGE_KEY = 'stellar_save_secret_key';

/**
 * Secret keys must only ever live here (iOS Keychain / Android Keystore via
 * expo-secure-store) — never in AsyncStorage, logs, or analytics payloads.
 */
export async function saveSecretKey(secretKey: string): Promise<void> {
  await SecureStore.setItemAsync(SECRET_KEY_STORAGE_KEY, secretKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function loadSecretKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SECRET_KEY_STORAGE_KEY);
}

export async function clearSecretKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY_STORAGE_KEY);
}
