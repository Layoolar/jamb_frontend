# Store listing — SabiPass

Copy-paste source for both stores. Fill the bracketed placeholders before
submitting.

---

## App name

**SabiPass**

Deliberately does not contain "JAMB". That is a trademark question independent of
the questions themselves — see PLAN §5.

## Subtitle (iOS, 30 char max)

`Beat your friends. Pass JAMB.` *(29)*

## Short description (Google Play, 80 char max)

`Timed JAMB practice you play against your friends. 10 questions, 15s each.` *(74)*

## Full description (both stores, 4000 char max)

```
Practice for JAMB the way you'll actually sit it — under time pressure.

SabiPass turns past questions and fresh practice questions into 10-question
duels. You get 15 seconds per question. So does your opponent. Faster correct
answers score more. At the end you see exactly where you both went wrong, with
an explanation for every question.

CHALLENGE ANYONE
Send a code to a friend on WhatsApp. They answer the same ten questions you did.
We compare the scores and tell you both who won. No need to be online at the
same time — play when you have a moment, they play when they have one.

NO OPPONENT RIGHT NOW?
Practice mode is the same questions, same timer, no pressure. Or take on the
bot, which we always label clearly as a bot.

BUILT SO THE TIMER MEANS SOMETHING
Screenshots and screen recording are blocked while a question is on screen, and
leaving the app during a question costs you that question. The clock runs on our
servers, so closing the app doesn't pause it. Fifteen seconds is not enough time
to look up an answer, and that's the point.

LEARN FROM WHAT YOU GOT WRONG
Every question comes with a short explanation of why the right answer is right —
and often why the tempting wrong one is wrong. The review screen shows your
answer next to your opponent's, question by question.

SUBJECTS
Use of English, Mathematics, Biology and Government, with more coming.

Found a question with a wrong answer? Report it from the review screen. We check
every report.

SabiPass is not affiliated with or endorsed by the Joint Admissions and
Matriculation Board (JAMB).
```

## Keywords (iOS, 100 char max, comma-separated, no spaces)

`jamb,utme,past questions,quiz,exam,nigeria,waec,practice,cbt,duel,revision,study`

Do not repeat words already in the app name or subtitle — Apple indexes those
separately, so repeating them wastes the budget.

## Category

- **Apple:** Education (secondary: Trivia — but Education is the honest one)
- **Google Play:** Education

## Age rating

- **Apple:** 4+. No objectionable content, no user-generated content, no
  unrestricted web access.
- **Google Play (IARC questionnaire):** answer No to violence, sexuality,
  language, controlled substances, gambling (there is no simulated gambling —
  points are not currency and cannot be purchased), and user-generated content.
  Expected outcome: Everyone / PEGI 3.

**Watch this one:** the IARC questionnaire asks whether users can interact.
Answer **yes** — players duel each other and see each other's usernames. Answering
no when a username is visible to another player is the kind of inaccuracy that
gets a listing pulled later.

---

## Apple — App Privacy answers

Data collected and **linked to the user**:

| Type | Purpose | Tracking? |
|---|---|---|
| Email address | App Functionality | No |
| User ID (account id, username) | App Functionality | No |
| Product Interaction (answers, scores, timings) | App Functionality, Analytics | No |
| Crash Data | App Functionality | No |
| Performance Data | App Functionality | No |

**Used for tracking: No.** We do not link this data to third-party data for
advertising, and there is no ad SDK in the app. Answering "yes" here would
trigger App Tracking Transparency, which we do not need and should not claim.

Not collected: location, contacts, photos, health, financial info, browsing
history, search history, sensitive info, advertising identifiers.

---

## Google Play — Data safety answers

- **Does your app collect or share user data?** Yes, collects. Does **not** share.
- **Is data encrypted in transit?** Yes.
- **Can users request data deletion?** Yes — in-app, Settings → Delete account.

| Data type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Required | Account management |
| User IDs | Yes | No | Required | Account management, App functionality |
| App interactions | Yes | No | Required | App functionality, Analytics |
| Crash logs | Yes | No | Optional | App functionality |
| Diagnostics | Yes | No | Optional | App functionality |

Declare **no** advertising or marketing purpose for anything.

---

## Screenshots

**Apple:** only the largest size per device family is required; Apple scales the
rest down.
- iPhone **6.9"** — 1320 × 2868 portrait. Must match pixel-for-pixel or upload fails.
- iPad 13" only if you ship iPad support (`supportsTablet` is currently `false`,
  so skip it).

**Google Play:**
- Phone screenshots, minimum 2, 1080 × 1920 or larger
- **Feature graphic, 1024 × 500** — required, and the one people forget

Suggested set of 5, in this order — lead with the duel, since that is the thing
competitors don't have:

1. Result screen showing a win against a friend, per-question comparison visible
2. Question screen mid-countdown, timer bar amber
3. Answer reveal with the explanation showing
4. Invite card with a duel code
5. Home screen with streak and record

Take these on a real device with real content. Placeholder or lorem screenshots
read as unfinished and cost installs.

---

## Pre-submission checks

- [ ] Privacy policy live and reachable at the URL you enter (not a 404)
- [ ] Terms live
- [ ] Support email that a person actually reads
- [ ] In-app account deletion reachable in under three taps *(App Store 5.1.1(v))*
- [ ] Export compliance: uses only standard HTTPS → exempt
- [ ] `targetSdkVersion` 36 confirmed in the uploaded bundle
- [ ] Sign-in tested in a **store-downloaded** build, not just the dev build
