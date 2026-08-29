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
src/app/            expo-router routes
  index.tsx         boot gate → sign-in or home
  sign-in.tsx       email/password
  username.tsx      shown once, after a new account
  home.tsx          record, streak, entry points, pending matches
  subjects.tsx      subject picker
  lobby/[matchId]   house rules + 3-2-1 countdown
  play/[matchId]    the question screen — this is the product
  result/[matchId]  score, per-question review vs opponent
  spike.tsx         Phase 1 anti-cheat harness (dev only)
src/components/     TimerBar, OptionButton, shared ui
src/lib/            api client, session, anticheat, server clock
src/store/auth.ts   zustand — auth only
src/theme.ts        tokens — one ochre accent, green/red reserved for answers
```

## Talking to the backend

A physical device cannot reach `localhost` — that is the phone's own loopback.
Set your machine's LAN address:

```bash
# .env
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000
```

Without it the client falls back to the Metro packager's host, which is usually
the right machine during development.

## Phase 1 — anti-cheat spike

`src/app/spike.tsx` is the **spike screen**, reachable at `/spike` via the DEV link at the bottom of Home. It arms real
capture protection and walks you through the GO / NO-GO checks from
[BUILD.md](BUILD.md) Phase 1. Run it on a physical Android device and iPhone, then
tap **Share results**.

Four critical checks decide the gate: Android screenshot, Android Gemini read,
Android Circle to Search, iOS screenshot. Delete the route once Phase 1 is signed
off — the DEV link only renders under `__DEV__`, so it never ships either way.

## Config notes

- `targetSdkVersion` is pinned to **36** explicitly rather than inherited from the
  SDK default — new apps submitted after 31 Aug 2026 are required to target it.
- `ios.deploymentTarget` is 16.4, the SDK 57 minimum.
- Android does **not** request `READ_MEDIA_IMAGES`. The screenshot *listener*
  needs it below Android 14, but Android already *blocks* screenshots via
  FLAG_SECURE, so the listener is only an iOS fallback — not worth a photo
  permission prompt and a Play sensitive-permission declaration.
