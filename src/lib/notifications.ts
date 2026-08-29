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
 * Registers for push and hands the token to the server.
 * Returns false when unavailable or declined — never throws, because a failed
 * registration must not interrupt whatever the player was doing.
 */
export async function registerForPush(): Promise<boolean> {
  try {
    // Simulators and emulators cannot receive push.
    if (!Device.isDevice) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('duels', {
        name: 'Duels',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return false;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await api.registerPushToken(
      token.data,
      Platform.OS === 'ios' ? 'ios' : 'android',
    );
    return true;
  } catch {
    return false;
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
