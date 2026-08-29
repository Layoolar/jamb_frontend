# JAMB Duel — MVP Build Plan

A React Native mobile app: JAMB past questions + AI-generated questions, played as timed 1v1 duels in a locked-down (no screenshot / no on-screen AI) environment.

**Target: ~6 weeks of work, ~7 weeks calendar, one developer, ~8 screens.**

The extra week is Google Play's mandatory 14-day closed test (§12), which is why it starts mid-build rather than at the end.

**Tick-as-you-go task list: [BUILD.md](BUILD.md).**

---

## 1. At a glance

| | |
|---|---|
| **App** | Expo (dev build, not Expo Go) + expo-router |
| **Backend** | Node 22 + Express 5 + TypeScript + Drizzle → Postgres 17. Own server. |
| **Auth** | Own JWT. Email/password + Google + Apple Sign-In. See §2.4 |
| **Hosting** | One Linux box, app + Postgres co-located, systemd (no Docker in prod). Provider is a deploy-time decision, not an architectural one. |
| **Duel model** | **Asynchronous** — both players answer the same 10 questions, on their own time, within 24h |
| **Timer** | 15s per question, **server-authoritative** |
| **Anti-cheat** | `expo-screen-capture` (capture block) + app-switch strikes + short timer |
| **v1 subjects** | English, Biology, Government (all text-only — see §5) |
| **Bank at launch** | ~750 live questions (250/subject), 70% past paper / 30% AI |

**The one big bet:** that blocking screen capture also blocks Gemini / Circle to Search from reading the question. Verify this in the first two days (§4).

---

## 2. The four decisions that shape everything

### 2.1 Async duels, not live sockets

Both players get the **same question set in the same order**, but play whenever they want. The server compares scores and settles.

Why this and not real-time WebSocket duels:

- No presence/matchmaking problem, no "opponent disconnected" state machine, no socket infra.
- **Survives bad networks.** On Nigerian mobile data, a dropped socket mid-match is a rage-quit. Async has no live connection to drop.
- Solves cold start: you can create a duel with zero users online.
- Roughly a third of the work of a live implementation.

You keep the *feeling* of 1v1 by showing the opponent's answer and time per question on the result screen, and by pushing "X just beat your score" notifications.

**Upgrade path (post-MVP):** the schema below is unchanged for live duels — you add a WebSocket layer (`ws` on the same Express server) for presence and a server-driven question index. Don't build it now.

### 2.2 Answer keys never leave the server

The whole exploit is one careless `res.json(question)` shipping `correct_index` to the client, where anyone reads it out of the network log. Code review will not reliably catch this. Make it mechanical:

**Every route declares a Zod response schema, and the response is `.parse()`d on the way out**, not just on the way in.

```ts
const ServedQuestion = z.object({
  qIndex: z.number(), questionId: z.string().uuid(),
  stem: z.string(), options: z.array(z.string()).length(4),
  deadlineAt: z.string().datetime(),
})   // correctIndex is absent → structurally cannot leak

res.json(ServedQuestion.parse(row))
```

`correct_index` and `explanation` appear in exactly one response schema in the codebase: the reply to a valid answer submission. Grep for the field name; if it shows up in two schemas, that's a bug.

Never trust the client's clock, either — `served_at` is stamped server-side (§6).

### 2.3 Anti-cheat is time pressure first, platform locks second

A second phone pointed at the screen defeats every technical control that exists. Accept that.

What actually stops cheating is that **15 seconds is not enough time to type a question into an AI and read the answer.** Capture blocking and app-switch detection exist to remove the *easy* paths (screenshot → Gemini, swipe to ChatGPT), not to be airtight.

Corollary: do not spend week 3 on root detection, emulator detection, or certificate pinning. Low return.

### 2.4 Auth: email/password, Google, Apple

Three sign-in paths, all landing on the same `users` row. Own JWT throughout — no third-party auth service, no per-MAU billing.

Apple's **Guideline 4.8**: offering a third-party/social login obliges you to also offer an equivalent option that limits collection to name and email, lets the user keep their email private, and doesn't collect app interactions for ads. Sign in with Apple satisfies it. Since we ship Google, **Apple Sign-In is required on iOS, not optional.**

```
POST /auth/signup             { email, password }  → argon2id, user row, tokens
POST /auth/login              { email, password }
POST /auth/oauth/:provider    → google | apple, verify ID token against JWKS
POST /auth/link               → attach another provider to the current account
POST /auth/refresh            → rotate (access 15m, refresh 30d, reuse detection)
POST /auth/password/forgot    → emailed single-use token  (Week 4, needs Resend)
POST /auth/password/reset     { token, password }
DELETE /auth/account          → required by App Store 5.1.1(v)
```

**Sequencing that keeps email out of Week 1:** signup and login need no email provider at all. Only *reset* does. Ship signup + login in Week 1, add the two password-reset routes in Week 4 alongside the Resend DNS setup (§12). Email verification is deferred past v1 — low stakes with no payments in the app.

**Account linking by email — decide this now, not later.** A user signs up with `ada@gmail.com`, then later taps Google with the same address. **Link** when the provider reports that email as verified and it matches an existing user; otherwise you create duplicate accounts with split streaks, which becomes your most common support ticket. Never link on an unverified email — that's an account-takeover path.

One shared verifier via `jose` `createRemoteJWKSet` + `jwtVerify`:

```ts
const ISSUERS = {
  google: { jwks: 'https://www.googleapis.com/oauth2/v3/certs',
            iss: 'https://accounts.google.com',  aud: GOOGLE_CLIENT_IDS },
  apple:  { jwks: 'https://appleid.apple.com/auth/keys',
            iss: 'https://appleid.apple.com',    aud: APPLE_BUNDLE_ID },
}
```

Client: `@react-native-google-signin/google-signin` + `expo-apple-authentication`. Both need a dev build, which the anti-cheat module already forces.

**Apple Sign-In needs far less setup than most guides claim.** Services IDs and `.p8` private keys are for *web* and Android Sign in with Apple flows. For a native iOS app you need exactly two things: tick "Sign In with Apple" on your App ID, and set `ios.usesAppleSignIn: true` in app.json (EAS adds the entitlement). **No Services ID, no private key, no client secret.** The client hands you an `identityToken` JWT; the server verifies it against Apple's JWKS like any other.

You'd only need the Services ID + `.p8` for the web redirect flow, exchanging authorization codes at Apple's token endpoint, or server-to-server account-deletion notifications. None are needed for v1.

**Four gotchas, each worth a lost day:**

1. **Apple returns the email only on the first authorization.** Persist it in that same request or it is gone permanently.
2. **Register BOTH Android SHA-1 fingerprints.** Play App Signing (mandatory for new apps) means Google re-signs your APK with their key. You must register your upload key's SHA-1 *and* the Play-signed one from the Play Console. Registering only the upload key is the classic "Google sign-in works in dev, fails in the store build."
3. **Google needs three OAuth client IDs** — iOS (bundle ID), Android (package + both SHA-1s), and a Web client ID used as the `serverClientId`/audience. The Web one being required for a mobile-only app surprises everyone.
4. **Apple gives no reliable display name.** You need a username step anyway (screen 8), so no extra work — just don't depend on the name field.

Hide My Email returns a `@privaterelay.appleid.com` address. Once you send password-reset mail, your sending domain must be registered with Apple's private email relay service or those messages bounce silently.

---

## 3. Match flow

```
A: taps "New duel" → picks subject
   ↓
server: POST /matches
   - picks 10 random live questions (7 past + 3 AI, difficulty-spread)
   - stores question_ids in order
   - status = 'awaiting_opponent', expires_at = now() + 24h
   ↓
A: plays all 10 (15s each, one served at a time)
   ↓
A: "Waiting for opponent" + share code / deep link
   ↓
B: joins via "Quick duel" (open-match pool) or A's code
B: plays the SAME 10 in the SAME order
   ↓
server: settle
   - higher score wins
   - tie → lower total_ms wins
   - still tie → draw
   ↓
push to both → result screen (per-question comparison + explanations)
```

**Unclaimed after 12h:** offer A a bot opponent, **clearly labelled "Bot"**, replaying a difficulty-matched score curve. This is the cold-start fix. Never present a bot as a real user.

### Scoring

```
correct  → 100 + round(remaining_ms / 150)   // max ~200 per question
wrong    → 0
timeout  → 0
```

No negative marking — it makes the game feel punishing and adds no signal. Max round score 2000.

### The latency detail that will bite you

Serve **one question at a time**. If the client prefetches question N+1, it gets extra thinking time on it.

The round-trip on 3G is 300–800ms, which would feel broken. Hide it: play a ~400ms "next question" transition (card slide + timer bar reset) and fire the request at the *start* of the animation. Also give a **1.5s grace** on the server deadline check so slow uploads aren't scored as timeouts.

---

## 4. Anti-cheat: what is actually possible

### Day-1 spike — do this before anything else

Build a bare Expo dev build with `expo-screen-capture` active on one screen. On a **real Android device** and a **real iPhone**, confirm:

1. Screenshot is blocked / comes out black.
2. Screen recording is blocked.
3. **Gemini (power-button hold) and Circle to Search cannot read the screen.**
4. `AppState` fires within ~200ms when you switch apps.

If #3 fails, the product premise changes — and you want to know on day 2, not in week 4.

### Platform reality

| Vector | Android | iOS |
|---|---|---|
| Screenshot | Blocked (`FLAG_SECURE`) | Blocked, iOS 13+ |
| Screen recording | Blocked | Blocked, iOS 11+ |
| Gemini / Circle to Search screen read | Expected blocked (same capture path) — **verify** | Expected blocked — **verify** |
| Switch to ChatGPT app | Detect via `AppState` → strike | Same |
| Split-screen / floating window | Detect multi-window; set `resizeableActivity=false` | iPad only — ignore for MVP |
| Overlay bubble | Detect `FLAG_WINDOW_IS_OBSCURED` on touch | n/a |
| Clock tampering | Irrelevant — server owns the clock | Same |
| **Second phone / camera** | **Cannot be stopped** | **Cannot be stopped** |

iOS screenshot blocking in `expo-screen-capture` is implemented natively rather than through a public "block screenshot" API, so treat it as verified-on-device, not guaranteed by contract.

### Strike policy

- Leave the app for >2s during a live question → that question scores **0** plus 1 strike.
- 2 strikes → match forfeit.
- **Show this rule in the lobby before the countdown.** A silent forfeit reads as a bug and loses the user.
- Record flags in `match_players.integrity_flags` for analysis. **Do not auto-ban in v1** — you will ban real users who took a phone call.

### Block capture on the question screen only

Deliberately **allow** screenshots on the result screen. That screen is your sharing loop — "I beat Tunde 1840–1600" going into a WhatsApp group is your cheapest acquisition channel. Toggle protection on mount/unmount of the question screen.

Other cheap wins: `selectable={false}` on question text (kills copy/paste), no header nav during a question, disable the Android back gesture mid-question.

---

## 5. Content pipeline — this is the real risk

The question bank *is* the product. A wrong answer key kills trust permanently. Budget more time here than feels reasonable.

### Subject choice is a rendering decision

Maths, Physics and Chemistry need equations and diagrams — that's a KaTeX or pre-rendered-image pipeline plus layout work for tall questions. It is a multi-week detour.

**v1 ships English, Biology, Government.** All three are text-only. Zero render work.
**v1.1 adds Maths / Physics / Chemistry** behind a KaTeX spike.

If you must have Maths at launch, restrict the bank to text-expressible items only (unicode superscripts, `x/y` fractions) — roughly 60% of the pool — and accept the gap.

### Sourcing past questions

Use questions circulating in public study sources. Store `year` and `subject` and show them ("JAMB 2019, Biology").

Practical posture, not legal advice:

- Don't put "JAMB" in the app name or use JAMB branding/logo — that's a trademark problem independent of the questions.
- Attribute year and subject; don't reproduce whole papers verbatim as a "download the 2019 paper" feature.
- Be takedown-ready: a `status` column means you can retire content in one SQL statement.
- Get an actual opinion from a Nigerian IP lawyer before you spend money on marketing.

### AI questions

**Generate offline in batches. Never at match time** — latency, cost, and unreviewed hallucinated answer keys.

Script (`jamb_backend/scripts/generate.ts`):

1. Prompt Claude for N questions in a subject/topic: stem, 4 options, correct index, 1–2 sentence explanation, difficulty 1–3.
2. **Self-check pass:** a second, independent call given only the stem and options and asked to solve it. Keep only where it agrees with the stated key. This catches most bad keys for a few cents.
3. Insert as `status = 'draft'`.
4. **Human-review 100% of drafts** for the first ~500. Promote to `status = 'live'`.

### The QA loop

A "Report question" button on the reveal screen writing to `question_reports`. Auto-set `status = 'flagged'` at 3 reports. Review in Drizzle Studio. This is ~2 hours of work and it is how you find the bad keys you shipped.

---

## 6. Data model

```sql
users          (id uuid pk, username unique, avatar_seed,
                email citext unique, email_verified bool default false,
                password_hash text null,          -- argon2id; null for social-only
                created_at, last_seen_at)

password_resets (token_hash pk, user_id, expires_at, used_at null)  -- single-use, 30min

accounts       (user_id, provider 'google'|'apple',
                provider_account_id, email null,  -- Apple: capture on FIRST auth only
                pk(provider, provider_account_id))

refresh_tokens (id, user_id, token_hash, family_id, used_at null,
                expires_at, revoked_at null)      -- rotation + reuse detection

subjects       (id, name, slug)

questions      (id, subject_id, source 'past'|'ai', year int null,
                stem text, options jsonb,        -- ["...","...","...","..."]
                correct_index int,               -- NEVER exposed to client
                explanation text,                -- released only after answering
                difficulty int, topic text,
                status 'draft'|'live'|'flagged'|'retired',
                reports_count int default 0)

matches        (id, subject_id, mode 'duel'|'solo',
                question_ids uuid[],             -- fixed order
                created_by, opponent_id null,
                status 'awaiting_opponent'|'in_progress'|'settled'|'expired',
                winner_id null, is_bot_opponent bool,
                invite_code text unique, expires_at, created_at)

match_players   (match_id, user_id, score int, total_ms int,
                 finished_at, integrity_flags jsonb, pk(match_id, user_id))

answers         (match_id, user_id, question_id, q_index int,
                 selected_index int null, is_correct bool, ms_taken int,
                 served_at, answered_at, pk(match_id, user_id, question_id))

user_stats      (user_id pk, wins, losses, draws, streak, best_streak)
question_reports(id, question_id, user_id, reason, created_at)
```

### The match endpoints

```
POST /matches                    { subjectSlug, mode }
  → { matchId, inviteCode, totalQuestions }

POST /matches/:id/question       (no body)
  → { qIndex, questionId, stem, options[], deadlineAt }
  · stamps answers.served_at = now() SERVER-side
  · IDEMPOTENT — on reconnect, re-serves the current question with its
    ORIGINAL deadline. If the app is killed mid-question, reopening must
    not grant a fresh 15 seconds. Easiest bug in this whole app to ship.

POST /matches/:id/answer         { questionId, selectedIndex, flags }
  → { isCorrect, correctIndex, explanation, points, runningScore }
  · rejects if now() > served_at + 15s + 1.5s grace → scores 0
  · merges flags into match_players.integrity_flags
  · the ONLY response schema in the codebase containing correctIndex

POST /matches/join               { inviteCode? }   -- omit = open-match pool
  → { matchId, ... }

GET  /matches/:id/result
  → per-question comparison for both players
```

**Settlement** runs inside the answer handler when the second player's final answer lands — one transaction, `SELECT … FOR UPDATE` on the match row so two simultaneous finishes can't double-settle.

**The quick-match pool is `SELECT … FOR UPDATE SKIP LOCKED`.** This is exactly what that clause exists for, it's atomic, and it's the reason you don't need Redis in v1. Add Redis later only to cache question serves — the one genuinely hot read.

Stale matches expired by an hourly `node-cron` job.

---

## 7. Screens (8)

| # | Screen | Notes |
|---|---|---|
| 1 | Auth / onboarding | Max 2 intro slides. Then one screen: **Continue with Google**, **Continue with Apple** (iOS only), or email/password. Username picked on first launch, not in the form. |
| 2 | Home | W/L record, streak, **Quick duel**, **Duel a friend**, pending matches, **Practice** |
| 3 | Subject picker | 3 cards + "Mixed" |
| 4 | Lobby | Rules (including the strike rule), 3-2-1 countdown |
| 5 | **Question** | Timer bar, 4 options, no nav, capture blocked. This screen is the product — spend your polish here. |
| 6 | Answer reveal | ~1s: correct option highlights, explanation line, "Report" link |
| 7 | Match result | Score, per-question comparison vs opponent, share, rematch |
| 8 | Profile | Username, stats, sign out |

**Practice mode reuses screens 5–7** with `mode='solo'`. It is nearly free once the quiz engine exists, and it is what makes the app usable on launch day with zero other users. Do not cut it.

### Design direction

Timer as a **shrinking bar**, not a ticking number — less anxiety-inducing and it reads peripherally. Big tap targets (full-width options, min 56px). Haptic on select, stronger haptic on correct. One accent colour; semantic green/red reserved for correct/wrong. Test on a low-end Android — that's the median device in this market.

---

## 8. Build phases

**Week 0 — Spike (2 days).** The anti-cheat verification in §4, nothing else. Also confirm the EAS dev build runs on a physical Android and iPhone.

**Week 1–1.5 — Backend, no UI (9 days).** Postgres + Drizzle migrations. Auth per §2.4 *minus* the password-reset routes: signup, login, Google, Apple, link, refresh, delete. The five match endpoints from §6, Zod response schemas both directions. **Register all three Google OAuth clients and the Apple App ID capability this week**, including both Android SHA-1s — left to Week 5 this is a ship blocker. Seed 100 questions by hand. **Drive a full duel to settlement with curl before writing any screen.** If the endpoint contract is wrong, find out here.

**Week 2 — Quiz engine.** Screens 4–7 and Practice mode end-to-end. Timer, transitions, haptics, reveal animation. Make this feel good; everything else is scaffolding around it.

**Week 3 — Duel loop.** Create/join, invite codes + deep links, quick-match pool, settlement, result comparison, push notifications, bot fallback.

**Week 4 — Content + lockdown.** Bank to ~750 live questions. AI batch generation + self-check + human review. Report flow. Wire anti-cheat onto the question screen. **Resend DNS setup + the two password-reset routes.** Design polish pass.

**Week 5 — Beta and ship.** TestFlight + Play closed testing. Watch three real candidates play in person — you'll learn more in three sessions than in three weeks of guessing. Fix, submit.

**⚠ The Play closed test starts at the end of Week 4, not Week 5.** See §12 — it's a hard 14-day wall plus up to 7 days of review, and starting it late is the most common way this timeline slips by three weeks.

---

## 9. Explicitly not in v1

Cut these and don't reopen the discussion until you have retained users:

- Email address *verification* (reset works without it; no payments in v1, so low stakes)
- **Guest / anonymous play.** Cut for simplicity. It's the first thing to add back if launch activation is poor — a signup wall in front of a free quiz app costs real conversion, and adding it later is just one more `accounts` provider plus a "claim your account" flow.
- Redis or any caching layer (`FOR UPDATE SKIP LOCKED` covers the one contended read)
- Docker in production (systemd is enough for one app + one database)
- Managed Postgres / RDS (co-located on the app box is cheaper *and* faster — 21 round-trips per match)
- Coins, gems, lives — any economy
- Avatars, cosmetics, customisation
- Chat, friends graph, social feed (invite-by-code is enough)
- ELO / ranks / divisions (W-L record + streak only)
- Tournaments, seasons, global leaderboard
- Offline mode
- Web app
- Subscriptions / IAP
- Admin dashboard (use Drizzle Studio)
- Root / emulator / tamper detection
- Live socket duels
- Maths, Physics, Chemistry
- Images, diagrams, equations in questions
- Multi-language

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Capture blocking doesn't stop Gemini reading the screen | **High** | Day-1 spike. If it fails, fall back to short-timer + strikes only, and say so honestly in the app. |
| Question bank too small, or answer keys wrong | **High** | AI self-check pass, 100% human review of the first 500, report button from day one |
| No opponents at launch | Medium | Practice mode, labelled bots, invite links into WhatsApp groups |
| "JAMB" name / verbatim papers → IP exposure | Medium | Keep JAMB out of the app name and branding; attribute; `status` column for fast takedown; get a local IP opinion |
| Low-end Android + 3G performance | Medium | Test on a budget device, throttle to 3G, 1.5s server grace, keep the bundle lean |
| Async duels feel less exciting than live | Medium | Per-question opponent comparison on the result screen, push notifications, rematch button |
| **Apple Developer enrollment stalls** — company enrollment needs a D-U-N-S number and can take 1–2 weeks. Blocks all iOS build/test/Apple-Sign-In work. | **High** | **Start enrolling today, before writing code.** Individual enrollment is usually <48h — take it if the entity doesn't matter yet. |
| **Play 12-tester / 14-day closed test discovered late** — adds ~3 weeks with no way to compress it | **High** | Start the closed test the moment a playable release candidate exists, end of Week 4 (§12) |
| OAuth client IDs / keystore SHA-1 misconfigured → sign-in works in dev, fails in the store build | Medium | Register both Android SHA-1s (upload + Play-signed) in Week 1; test against a real release build, not just the dev build |
| Duplicate accounts from email/social overlap | Medium | Link on verified-email match only (§2.4); never on an unverified email |
| You now own auth security | Medium | No hand-rolled crypto — `jose` for JWKS verification, `argon2` if passwords ever return. Rotating refresh tokens with reuse detection. Rate-limit the auth routes. |
| Signup wall depresses launch activation | Medium | Measure install→first-duel conversion from day one. If it's poor, add guest play (§9) — it's the cheapest fix available. |

---

## 11. Repo layout

```
jamb_frontend/          Expo app
  app/                  expo-router routes
  src/features/quiz/    engine: timer, question card, reveal
  src/features/duel/    create, join, result
  src/lib/api.ts        typed client, token refresh interceptor
  src/lib/auth.ts       session store, Google/Apple sign-in, token refresh
  src/lib/anticheat.ts  capture block, AppState strikes
  src/theme.ts          tokens (skip NativeWind unless you already like it)

jamb_backend/         Node 22 + Express 5 + TypeScript
  src/routes/           matches, auth, reports
  src/schemas/          Zod — request AND response (§2.2)
  src/auth/             argon2id, jwks verify, token rotation, linking
  src/db/               Drizzle schema + migrations
  scripts/generate.ts   AI batch generation + self-check
  scripts/import.ts     past-question CSV import
  content/              source CSVs
  deploy/               systemd unit, Caddyfile, pg_dump cron
```

**Frontend state:** Zustand for live match UI state, TanStack Query for server data. No Redux.
**Local dev:** Docker for Postgres only — least annoying way to get a matching Postgres on Windows. Not used in production.
**Admin/content review:** Drizzle Studio.
**From day one:** Sentry free tier — Android device diversity will surprise you.
**Backups:** nightly `pg_dump` to object storage, and actually restore one before launch.

---

## 12. Non-coding setup — start the first two today

Roughly half a day of portal clicking in total. Only the enrollments carry calendar risk, and they block everything downstream, so they go first.

| Task | Effort | Cost | Lead time |
|---|---|---|---|
| **Apple Developer Program enrollment** | 20 min | $99/yr | **<48h individual, 1–2 weeks company (D-U-N-S)** |
| **Google Play Console account** | 20 min | $25 once | Days — identity verification |
| **Play closed test: 12 testers, 14 continuous days** | Recruiting is the work | — | **14 days + ≤7 days review.** Start end of Week 4. |
| Domain registration | 10 min | ~$12/yr | Minutes |
| Apple App ID + "Sign In with Apple" capability | 5 min | — | None |
| `ios.usesAppleSignIn: true` in app.json | 2 min | — | None |
| Google Cloud project + OAuth consent screen | 15 min | — | None |
| Three Google OAuth client IDs (iOS / Android / Web) | 20 min | — | None |
| Both Android SHA-1s registered (upload + Play-signed) | 15 min | — | None |
| Resend account + 3 DNS records (SPF, DKIM, DMARC) | 30 min | Free to 3k/mo | DNS propagation, <1h |
| Privacy policy + terms page at your domain | 1–2h | — | Required by both stores |
| Sentry project | 10 min | Free tier | None |
| **Firebase project + FCM V1 service-account key uploaded to EAS** | 25 min | Free | None — but **Android push is dead until this is done** |

**Almost none of this is Apple-Sign-In-specific** — it's the cost of shipping on iOS at all, which you're paying regardless. Apple Sign-In itself adds about 10 minutes on top.

Two store rules that are code, not clicks, and are rejection reasons:

- **In-app account deletion** (App Store 5.1.1(v)) — required because you support account creation. Covered by `DELETE /auth/account` in §2.4.
- **A data-collection disclosure** — App Privacy details on Apple, Data Safety form on Google Play. Declare email address and any device identifiers, and state that data is linked to the user's identity.
