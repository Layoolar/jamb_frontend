import * as SecureStore from 'expo-secure-store';
import type { PublicUser } from './types';

/**
 * Token storage. SecureStore is the Keychain / Android Keystore, which is where
 * a refresh token belongs — it is a long-lived credential.
 */

const ACCESS = 'sabipass.access';
const REFRESH = 'sabipass.refresh';
const USER = 'sabipass.user';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

export async function saveSession(s: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, s.accessToken),
    SecureStore.setItemAsync(REFRESH, s.refreshToken),
    SecureStore.setItemAsync(USER, JSON.stringify(s.user)),
  ]);
}

export async function loadSession(): Promise<Session | null> {
  try {
    const [accessToken, refreshToken, userRaw] = await Promise.all([
      SecureStore.getItemAsync(ACCESS),
      SecureStore.getItemAsync(REFRESH),
      SecureStore.getItemAsync(USER),
    ]);
    if (!accessToken || !refreshToken || !userRaw) return null;
    return { accessToken, refreshToken, user: JSON.parse(userRaw) as PublicUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(USER),
  ]);
}

export async function updateTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, accessToken),
    SecureStore.setItemAsync(REFRESH, refreshToken),
  ]);
}
