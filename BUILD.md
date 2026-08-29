# JAMB Duel — Build Checklist

Companion to [PLAN.md](PLAN.md). Tick as you go. Each phase has an **exit gate** — do not start the next phase until the gate is true.

**~6 weeks of work, ~7 weeks calendar.** The gap is Google Play's mandatory 14-day closed test (Phase 6), which is why it starts *during* Phase 5, not after.

## Critical path — two items with calendar risk

These block everything downstream and cannot be compressed. Start both on Day 0.

| Blocker | Lead time | Consequence if late |
|---|---|---|
| **Apple Developer enrollment** | <48h individual · **1–2 weeks company (D-U-N-S)** | No iOS build, test, or Apple Sign-In work at all |
| **Google Play 12-tester / 14-day closed test** | **14 days + up to 7 days review** | Cannot publish to production, full stop |

---

## Phase 0 — Unblock (Day 0, half a day)

Goal: start every clock that isn't under your control.

### Do these first, in this order
- [ ] Enrol in **Apple Developer Program** ($99/yr). Individual unless the legal entity matters now — company enrollment needs a D-U-N-S number and adds 1–2 weeks.
- [ ] Create **Google Play Console** account ($25 once). Note: personal accounts created after 13 Nov 2023 are subject to the 12-tester rule in Phase 6. An organisation account is exempt but needs a D-U-N-S number.
- [ ] Register a domain (needed for privacy policy, and later email)

### While those process
- [x] Create the two repos / init `jamb_frontend` and `jamb_backend`
- [x] Pick an Expo SDK that targets **Android API 36**. Using SDK 57 with `targetSdkVersion: 36` pinned explicitly in `app.json` via `expo-build-properties`, not inherited from the SDK default — new apps submitted after 31 Aug 2026 are required to target it.
- [ ] Google Cloud project + OAuth consent screen
- [ ] Sentry project, both platforms
- [x] Decide the app name — **SabiPass**, `com.sabipass.app`, scheme `sabipass://`

### Deferred to when you have a build
- [ ] Apple App ID + tick "Sign In with Apple"
- [ ] Three Google OAuth client IDs (iOS / Android / Web)
- [ ] Both Android SHA-1s registered (upload key **and** Play-signed key)
- [ ] Resend account + DNS records (Phase 5)

**Exit gate:** Apple enrollment submitted, Play account submitted, domain owned.

---

## Phase 1 — Anti-cheat spike (Days 1–2) · GO / NO-GO

Goal: prove the core premise before building anything on top of it. Nothing else happens this phase.

- [ ] Bare Expo app, EAS **development build** installed on a physical Android device *(spike screen is written — route `/spike`, reachable from the DEV link at the bottom of Home; you run it)*
- [ ] Same on a physical iPhone
- [ ] `expo-screen-capture` → `preventScreenCaptureAsync()` on one screen
- [ ] **Android: screenshot blocked / black**
- [ ] **Android: screen recording blocked**
- [ ] **Android: Gemini (power-button hold) cannot read the screen**
- [ ] **Android: Circle to Search cannot read the screen**
- [ ] **iOS: screenshot blocked** (Expo claims iOS 13+; verify, it's a native trick not a public API)
- [ ] **iOS: screen recording blocked**
- [ ] `AppState` fires within ~200ms on app switch, both platforms
- [ ] Android multi-window / split-screen detectable
- [ ] Confirm protection can be toggled **off** per-screen (needed for the shareable result screen)

**Exit gate:** all four bolded items pass. If the Gemini checks fail, stop and re-read PLAN §2.3 — the product still works on the 15-second timer alone, but say so honestly in the app rather than claiming a locked environment.

---

## Phase 2 — Backend, no UI (Days 3–11, 9 days)

Goal: a complete duel playable end-to-end with curl. No React Native this phase.

### Foundation
- [x] Express 5 + TypeScript + tsx, Postgres 18 in a container on **port 55433** — the native 13 and 18 installs own 5432 *and* 5433 and are password-locked, so pointing at 5433 silently reaches the wrong server
- [x] Drizzle schema from PLAN §6, first migration
- [x] Zod schemas — request **and response** (PLAN §2.2)
- [x] Error handler, request logging, health endpoint

### Auth (PLAN §2.4)
- [x] `POST /auth/signup` — argon2id
- [x] `POST /auth/login`
- [x] `POST /auth/oauth/google` — `jose` + `createRemoteJWKSet`
- [x] `POST /auth/oauth/apple` — same verifier, different issuer/audience
- [x] `POST /auth/link`
- [x] `POST /auth/refresh` — rotation with reuse detection
- [x] `DELETE /auth/account` — App Store 5.1.1(v), not optional
- [x] **Account linking rule:** link on verified-email match only, never unverified
- [x] Rate limit all auth routes
- [ ] Register the three Google OAuth clients + both Android SHA-1s **now**

### Match engine
- [x] `POST /matches` — random 10, 7 past / 3 AI, difficulty spread
- [x] `POST /matches/:id/question` — stamps `served_at` server-side
- [x] **Serve is idempotent** — reconnect returns the current question with its *original* deadline. Kill the app mid-question and confirm you do not get a fresh 15s.
- [x] `POST /matches/:id/answer` — deadline + 1.5s grace, scoring, integrity flags
- [x] **`correctIndex` appears in exactly one response schema.** Grep to confirm.
- [x] `POST /matches/join` — `SELECT … FOR UPDATE SKIP LOCKED`
- [x] `GET /matches/:id/result`
- [x] Settlement in one transaction, `FOR UPDATE` on the match row — two simultaneous finishes cannot double-settle
- [ ] Bot opponent fallback for unclaimed matches *(schema column exists; fill logic not written)*
- [x] Hourly `node-cron` expiry job

### Content
- [x] `scripts/import.ts` — CSV → questions
- [ ] Seed 100 real questions by hand across the 4 subjects *(48 seeded via `npm run seed` — original practice items, honestly recorded as source=ai. Real past papers still needed.)*
- [x] `POST /questions/:id/report` + auto-flag at 3

**Exit gate:** two curl sessions play the same match to settlement, scores and winner correct. Late answers score 0. Restarting mid-question does not grant extra time.

---

## Phase 3 — Quiz engine UI (Days 12–18)

Goal: practice mode feels good end to end. This screen is the product.

- [x] Expo app, expo-router, `theme.ts` tokens
- [x] Typed API client + token refresh interceptor
- [x] Zustand store for auth, TanStack Query for server data *(match state is component-local — a store would add indirection with no shared reader)*
- [ ] Auth screens — Google, Apple (iOS only), email/password *(email/password done; Google/Apple buttons land in Phase 4 with the OAuth client registration — dead buttons are worse than none)*
- [ ] **Test Google sign-in against a real release build, not just the dev build**
- [x] Username picker on first launch
- [x] Home screen — record, streak, entry points
- [x] Subject picker
- [x] Lobby — rules incl. the strike rule, 3-2-1 countdown
- [x] **Question screen** — shrinking timer bar, 4 full-width options (min 56px), no nav
- [x] `selectable={false}` on stems; Android back gesture disabled mid-question
- [x] ~400ms next-question transition, request fired at animation start
- [x] Answer reveal — highlight, explanation, report link
- [x] Haptics: select, and a stronger one on correct
- [x] Practice mode end to end
- [x] Result screen
- [x] `prefers-reduced-motion` equivalent respected
- [ ] **Test on a low-end Android** and on 3G throttle

**Exit gate:** you can play 10 practice questions and it feels good enough that you'd show someone. Timer never desyncs from the server.

---

## Phase 4 — Duel loop (Days 19–25)

- [ ] Create duel → waiting state
- [ ] Invite code + deep link (`expo-linking`), tested from WhatsApp
- [ ] Quick duel from the open-match pool
- [ ] Join by code
- [ ] Per-question opponent comparison on the result screen
- [ ] Rematch button
- [ ] Push notifications (`expo-notifications`) — opponent finished, you won/lost, duel expiring
- [ ] Push permission asked *after* the first duel, not at launch
- [ ] Bot opponent, **labelled "Bot"** in the UI
- [ ] Pending matches list on Home
- [ ] Share result — image or text, screenshots deliberately allowed here

**Exit gate:** two real phones complete a duel start to finish, both get correct results and notifications. **Build a release candidate — Phase 6 starts now, in parallel.**

---

## Phase 5 — Content, lockdown, polish (Days 26–32)

### Anti-cheat wiring
- [ ] Capture protection on question-screen mount, released on unmount
- [ ] Verify the result screen *is* screenshottable
- [ ] AppState strikes: >2s away → question scores 0 + strike; 2 strikes → forfeit
- [ ] Strike rule shown in the lobby before the countdown
- [ ] Android multi-window blocks play; `resizeableActivity=false`
- [ ] Flags posted to the server; **no auto-bans**
- [ ] iOS screenshot listener → flag

### Content to launch volume
- [ ] ~250 live questions each: English, Biology, Government, Maths (text-expressible items only — `content_format='plain'`)
- [ ] `scripts/generate.ts` — batch AI generation
- [ ] **Self-check pass** — independent solve, keep only where it agrees
- [ ] Human-review 100% of AI drafts before `status='live'`
- [ ] Spot-check 50 imported past questions against their source
- [ ] Report queue reviewable in Drizzle Studio

### Email + polish
- [ ] Resend + SPF/DKIM/DMARC verified
- [ ] `POST /auth/password/forgot` + `/reset` — single-use, 30 min
- [ ] Send a real reset email to Gmail and confirm it isn't spam-foldered
- [ ] Design pass: empty states, loading, error states
- [ ] Every error says what happened and what to do
- [ ] App icon + splash, adaptive icon for Android

### Production
- [ ] Provision the box, Postgres + app co-located, systemd, Caddy TLS
- [ ] Nightly `pg_dump` to object storage
- [ ] **Restore a backup and verify it works** — untested backups aren't backups
- [ ] Sentry live on both platforms

**Exit gate:** production is live and serving real duels. Backup restore verified.

---

## Phase 6 — Closed beta (starts Day 25, runs 14+ days)

**Start the Play closed test the moment Phase 4's release candidate exists.** This is a hard 14-day wall and it is the single most common cause of a launch slipping by three weeks.

### Google Play — mandatory gate
- [ ] Upload the RC to a **closed testing** track
- [ ] Recruit **12+ testers** who will actually install
- [ ] Confirm all 12 are **opted in and installed** — invited-but-not-installed does not count
- [ ] Testers must stay opted in **14 continuous days**
- [ ] Nudge testers to open the app 2–3 times across the period — Google now checks genuine engagement
- [ ] Day 14: apply for production access (review is usually ≤7 days)

### Apple TestFlight
- [ ] Internal testers, then external if you want more than 25
- [ ] Confirm Apple Sign-In works on a TestFlight build

### What to watch
- [ ] Sit with 3 real JAMB candidates while they play. Watch, don't explain.
- [ ] Install → first-duel conversion (the signup-wall risk, PLAN §10)
- [ ] Reported questions — fix keys immediately
- [ ] Crash-free rate in Sentry
- [ ] Integrity flag rate — is the 2s threshold catching real users?

**Exit gate:** Play production access granted. Crash-free >99%. No open answer-key reports.

---

## Phase 7 — Store submission (Days 33–40)

### Both stores
- [ ] Privacy policy + terms live at your domain
- [ ] Age rating questionnaires
- [ ] Description, keywords, category
- [ ] Support contact

### Apple
- [ ] Screenshots at **6.9" iPhone (1320×2868)** — Apple scales down from the largest size per family. Add 13" iPad only if you support iPad.
- [ ] App Privacy details — declare email and any device identifiers
- [ ] Export compliance (standard HTTPS exemption)
- [ ] Confirm in-app account deletion is reachable — a known rejection reason
- [ ] Submit

### Google
- [ ] Phone screenshots + **feature graphic 1024×500**
- [ ] Data Safety form
- [ ] Target API 36 confirmed
- [ ] Promote to production

**Exit gate:** approved on both stores.

---

## Phase 8 — Launch

- [ ] Verify the release build against **production**, not staging
- [ ] Confirm Google sign-in works in the **store-downloaded** build (the Play-signed SHA-1 moment of truth)
- [ ] Seed the first duels yourself so early users find opponents
- [ ] Share invite links into 3–5 real JAMB WhatsApp groups
- [ ] Watch Sentry for 48h

### Week 1 metrics
- [ ] Install → first duel
- [ ] Duels per user per day
- [ ] Day-1 and Day-7 retention
- [ ] Question reports per 1,000 answers
- [ ] Unclaimed-duel rate (are people finding opponents?)

### First things to add, in order
1. Guest play — if install→first-duel is poor (PLAN §9)
2. Maths / Physics / Chemistry behind a KaTeX spike
3. Live socket duels
4. Weekly leaderboard

---

## Ordering rules

1. **Phase 1 before everything.** Two days to test a premise the whole product rests on.
2. **Phase 2 has no UI.** If the endpoint contract is wrong, find out with curl.
3. **Phase 6 overlaps Phase 5.** The 14-day Play clock starts at the end of Phase 4.
4. **OAuth registration happens in Phase 2**, not at submission. Sign-in that works in dev and breaks in the store build is the classic one-week loss.
5. **Content is not a final step.** It's Phase 5 work and it's the largest single risk in the plan.
