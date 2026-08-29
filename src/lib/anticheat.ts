/**
 * Anti-cheat primitives (PLAN §2.3, §4).
 *
 * Deterrence, not prevention — a second phone pointed at the screen defeats all
 * of this. The real control is the 15-second timer. These close the easy paths.
 *
 * Every call is feature-detected and never throws: a native module that behaves
 * differently across an OS version must degrade, not crash a live match.
 */

import * as ScreenCapture from 'expo-screen-capture';
import { AppState, type AppStateStatus, Dimensions, Platform } from 'react-native';

export type CaptureArmResult = {
  armed: boolean;
  /** Non-fatal reason protection could not be armed. Surface it, don't throw. */
  reason?: string;
};

/**
 * Blocks screenshots and screen recording for as long as `tag` is held.
 * Android: FLAG_SECURE. iOS: native obscuring (recordings iOS 11+, screenshots iOS 13+).
 *
 * Tags are ref-counted by expo-screen-capture, so nested holders are safe.
 * Arm this on the question screen only — the result screen must stay
 * screenshottable, it's the sharing loop (PLAN §4).
 */
export async function armCaptureProtection(tag: string): Promise<CaptureArmResult> {
  try {
    await ScreenCapture.preventScreenCaptureAsync(tag);
    return { armed: true };
  } catch (e) {
    return { armed: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function releaseCaptureProtection(tag: string): Promise<void> {
  try {
    await ScreenCapture.allowScreenCaptureAsync(tag);
  } catch {
    // Releasing a tag that was never armed is not an error worth surfacing.
  }
}

/**
 * Requests the permission the screenshot listener needs on older Android.
 * Android 14+ needs nothing; iOS always resolves granted.
 */
export async function requestScreenshotDetectionPermission(): Promise<boolean> {
  try {
    const fn = (ScreenCapture as Record<string, unknown>).requestPermissionsAsync;
    if (typeof fn !== 'function') return true;
    const res = (await (fn as () => Promise<{ granted: boolean }>)()) ?? { granted: false };
    return Boolean(res.granted);
  } catch {
    return false;
  }
}

/**
 * Fires when the user takes a screenshot while the app is foregrounded.
 * On iOS this is the fallback signal if blocking silently fails; on Android a
 * fire while armed means FLAG_SECURE is not doing its job — treat as a bug.
 */
export function onScreenshot(cb: () => void): () => void {
  try {
    const sub = ScreenCapture.addScreenshotListener(cb);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/**
 * Android split-screen / freeform heuristic: in multi-window the app's window
 * is strictly smaller than the physical screen. Cheap, no native module.
 */
export function isSplitScreen(): boolean {
  if (Platform.OS !== 'android') return false;
  const w = Dimensions.get('window');
  const s = Dimensions.get('screen');
  // Allow slack for system bars, which are excluded from the window metrics.
  return s.height - w.height > 200 || s.width - w.width > 40;
}

export type AwayEvent = {
  /** How long the app was not in the foreground. */
  msAway: number;
  /** True once past the strike threshold. */
  isStrike: boolean;
};

/**
 * Watches for the user leaving the app — the "swipe to ChatGPT" path.
 * Returns an unsubscribe function.
 */
export function watchAppAway(
  onAway: (e: AwayEvent) => void,
  thresholdMs = 2000,
): () => void {
  let leftAt: number | null = null;

  const handle = (state: AppStateStatus) => {
    if (state === 'active') {
      if (leftAt !== null) {
        const msAway = Date.now() - leftAt;
        leftAt = null;
        onAway({ msAway, isStrike: msAway > thresholdMs });
      }
      return;
    }
    // 'background' on both platforms; 'inactive' also covers the iOS app switcher.
    if (leftAt === null) leftAt = Date.now();
  };

  const sub = AppState.addEventListener('change', handle);
  return () => sub.remove();
}
