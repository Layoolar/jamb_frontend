# SabiPass — mobile app

Timed 1v1 JAMB quiz duels. Expo SDK 57 / React Native 0.86 / expo-router.

Plan: [PLAN.md](PLAN.md) · Checklist: [BUILD.md](BUILD.md) · Backend: `../jamb_backend`

## Running it

**Expo Go will not work.** The anti-cheat module (`expo-screen-capture`) is native,
so you need a development build.

```bash
npm install

# One-time, per platform — produces an installable dev build
npx eas login
npx eas build --profile development --platform android
npx eas build --profile development --platform ios

# Then, day to day
npm start
```

Install the resulting build on a **physical device**. The anti-cheat behaviour
cannot be validated on a simulator.

## Layout

```
src/app/          expo-router routes
src/lib/          anticheat, api client, auth
src/theme.ts      design tokens — one ochre accent, green/red reserved for answers
```

## Phase 1 — anti-cheat spike

`src/app/index.tsx` is currently the **spike screen**, not the app. It arms real
capture protection and walks you through the GO / NO-GO checks from
[BUILD.md](BUILD.md) Phase 1. Run it on a physical Android device and iPhone, then
tap **Share results**.

Four critical checks decide the gate: Android screenshot, Android Gemini read,
Android Circle to Search, iOS screenshot. This file is replaced by the real Home
screen at the start of Phase 3.

## Config notes

- `targetSdkVersion` is pinned to **36** explicitly rather than inherited from the
  SDK default — new apps submitted after 31 Aug 2026 are required to target it.
- `ios.deploymentTarget` is 16.4, the SDK 57 minimum.
- Android does **not** request `READ_MEDIA_IMAGES`. The screenshot *listener*
  needs it below Android 14, but Android already *blocks* screenshots via
  FLAG_SECURE, so the listener is only an iOS fallback — not worth a photo
  permission prompt and a Play sensitive-permission declaration.
