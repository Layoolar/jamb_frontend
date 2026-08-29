/**
 * Push notifications (PLAN §7).
 *
 * Permission is requested AFTER a player's first duel, never at launch. A
 * cold permission prompt on first open is the single easiest way to get a
 * permanent "no", and on iOS a denial cannot be re-prompted — you get one ask.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * The Android channel every duel notification is posted to.
 *
 * Created before the token is ever fetched, not just on the permission ask:
 * Android silently drops a notification whose channel does not exist, and on
 * a returning device we sync a token without going near the permission flow.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('duels', {
    name: 'Duels',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
  });
}

/**
 * Fetches the Expo push token and hands it to the server.
 *
 * The projectId is required — getExpoPushTokenAsync throws without it. It was
 * missing until an EAS project existed, and because every caller here swallows
 * failures, push failed completely silently. Read it explicitly and throw a
 * legible error rather than letting an undefined bubble into the SDK.
 */
async function uploadToken(): Promise<boolean> {
  await ensureChannel();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    if (__DEV__) console.warn('[push] no EAS projectId — cannot fetch a token');
    return false;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.registerPushToken(token.data, Platform.OS === 'ios' ? 'ios' : 'android');
  return true;
}

/**
 * Registers for push and hands the token to the server.
 * Returns false when unavailable or declined — never throws, because a failed
 * registration must not interrupt whatever the player was doing.
 */
export async function registerForPush(): Promise<boolean> {
  try {
    // Simulators and emulators cannot receive push.
    if (!Device.isDevice) return false;

    await ensureChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return false;

    return await uploadToken();
  } catch {
    return false;
  }
}

/**
 * Re-uploads the token on launch when permission is ALREADY granted.
 *
 * Expo push tokens are not permanent: they rotate on reinstall, on restore to
 * a new device, and when credentials are rebuilt. registerForPush only ever
 * runs once — on the first duel result, gated by hasBeenAsked — so without
 * this a rotated token leaves the account unreachable forever, with no error
 * anywhere. Cheap enough to run every cold start.
 */
export async function syncPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return;
    await uploadToken();
  } catch {
    // Same reasoning as registerForPush: never surface this to the player.
  }
}

/** True once the player has already been asked, so we do not ask twice. */
export async function hasBeenAsked(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || !p.canAskAgain;
  } catch {
    return true;
  }
}
