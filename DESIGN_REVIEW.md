# SabiPass Mobile UI/UX Design Review

Two passes. The first was a general review of the implemented screens. The
second verified its claims against the code and added the states it did not
cover. Corrections show their working, so you can disagree with the reasoning
rather than just the conclusion.

## Product context

SabiPass is a timed, asynchronous 1v1 JAMB quiz app. A player answers ten
questions with fifteen seconds per question, either against an opponent or in
solo practice. The question screen is the product: it must remain highly
legible, fast to operate, and free from distractions.

The app should feel like a modern, trustworthy exam companion with competitive
energy, rather than a generic arcade quiz game.

---

## Visual direction — agreed

Commit to an **exam paper, not arcade** identity:

- Warm paper surfaces, dark ink text, and one confident ochre action colour.
- Calm, focused preparation before a match; urgency only while answering.
- A respectful, grown-up tone. Avoid coins, confetti, XP bars, cartoon
  illustrations, and dense dashboard UI.
- Green and red stay **strictly semantic** — green for correct, red for wrong.
  Under time pressure a colour that means two things means nothing.
- **No subject-per-colour system.** Multiple vivid subject colours would compete
  with the answer states.

This is right, and the build already follows it.

---

## Verification of the first review

| Claim | Status |
|---|---|
| App icon does not match the palette | **Confirmed** — it is Expo's default blue chevron. Ship-blocker. |
| Resume should sit above Quick duel | **Confirmed** — pending matches currently render *below* the buttons |
| Recent rows should show outcome and score | **Confirmed** — they show subject + "VIEW" |
| Subject selection needs an explicit indicator | **Confirmed** — selection is colour-only, an accessibility problem |
| Lobby rules should be scannable rows | **Confirmed** — currently four full sentences |
| Heavier A/B/C/D markers | Fair, minor |
| Tapped option needs a neutral locked-in state | **Already built** — and load-bearing for the sealed-score rule, not cosmetic |
| Tabular numerals for scores and timers | **Already built** |
| Progress bar as the primary timer signal | **Already built** |
| Answer text 16–18px, stems 21–24px | **Already built** — 17px and 22px |
| Use a light foreground on red answer surfaces | **Wrong — would break contrast.** See below |
| Ship a custom humanist sans app-wide | **Partly disagree.** See Typography |

### The contrast correction

Measured with the WCAG relative-luminance formula against the real token values:

| Surface | dark text `#0F0D0A` | white text |
|---|---|---|
| correct green `#3FB96B` | **7.73** (AAA) | 2.51 (fails) |
| wrong red `#E0503F` | **4.98** (AA) | 3.90 (fails AA) |

Dark-on-red already passes AA. Moving to a light foreground would drop it below
the threshold. Every pair in the current palette passes AA — leave it.

---

## Palette: two measured bugs

The ochre direction is right. It reads as paper and pencil rather than corporate
SaaS, and critically it leaves green and red entirely free for answer semantics.
But the execution has two real flaws.

### 1. The accent collides with the timer's warning state

The timer bar runs ochre → amber → red:

| State | Hex | Hue |
|---|---|---|
| accent, >50% left | `#E0902F` | 33° |
| warn, 50–20% | `#E0B03F` | 42° |
| wrong, <20% | `#E0503F` | 6° |

**Nine degrees** between "you're fine" and "hurry up". That transition is
effectively invisible, at the exact moment it matters most.

**Fix: drop the amber stop.** Go accent → red, two states. Not a compromise —
three state changes inside fifteen seconds is too many to read under pressure
anyway. Removing amber fixes the collision *and* calms the timer.

### 2. Cards do not separate from the background

| Theme | bg vs surface | Ratio |
|---|---|---|
| Light | `#FAF7F2` vs `#FFFFFF` | 1.07 |
| Dark | `#14120F` vs `#1F1B16` | 1.09 |

Both are imperceptible. Every card in the app is held up by its 1px border
alone, which is most of why the interface reads flat rather than composed.
Pushing surface further from background in both themes does more for perceived
quality than any amount of decoration.

### 3. Opportunity: one cool note

Every colour in the palette is warm — background, surface, accent, muted text.
Coherent, but monotone, and it gives the eye nothing to push against.

A single cool tone used in exactly one place would give the palette tension and
make the ochre read warmer by contrast. The natural home is the **sealed /
waiting** state, which should feel categorically different from every other
screen.

---

## Should it be more beautiful?

Yes — but on three screens only.

The restraint on the question screen is correct and should not be touched. The
mistake was applying that same restraint to the *entire app*. Home, sign-in and
the result screen have no clock running, and there is real value unclaimed
there.

Ranked by payoff:

**1. The result screen.** This is the share asset — the only screen a
*non-user* ever sees, pasted into a WhatsApp study group. It is currently a card
with numbers in it. It is doing acquisition work while dressed for a settings
menu. Highest return in the app.

**2. Sign-in.** Decides whether a first-time opener comes back. A small brand
mark and a quiet answer-sheet texture behind the title is enough. No slides.

**3. The 3-2-1 countdown.** Pure anticipation, zero risk, currently a plain
numeral. Free drama.

**Explicitly not:** the question screen, illustrations, gradients, or motion
anywhere near a live question.

### Typography

The first review proposed one humanist sans app-wide (Source Sans 3, DM Sans).
Half right.

We currently ship **zero font bytes** and inherit Roboto on Android and SF on
iOS. Both are excellent humanist faces, already on the device, rendering with no
load flash. For **answer text and question stems, system fonts win** —
legibility under a 15-second clock is the only criterion, and nothing bundled
beats them.

But type is where most of "beautiful" actually lives, and headings are not under
time pressure.

**Recommendation: one display face, headings only.** Title, Eyebrow, and score
numerals. Body, answers and stems stay system. One variable weight (~40–90KB
subset to Latin), roughly eight text nodes, a large perceived-quality gain, and
zero risk to the question screen.

Candidates with real character — avoid Inter and Space Grotesk, which read as
defaults: **Fraunces**, **Zilla Slab**, **Bricolage Grotesque**. Whichever is
chosen needs solid tabular figures, since scores and timers are first-class
elements here.

---

## The states the first review did not cover

It reviewed the happy path. These are the states most likely to actually lose a
user, and three are bugs rather than polish.

### 1. The forfeit is a gotcha — and contradicts our own plan

There is no strike warning anywhere in the app. Today: you leave during a
question, come back, answer, and nothing is said. Do it once more and you are
ejected to a result screen with a red box.

PLAN §4 says *"a silent forfeit reads as a bug and loses the user."* The lobby
rule was built; the part that makes it fair was not. Nobody reads a rules
screen — the warning at strike one is what turns a punishment into a fair cop.

**Fix:** on returning to a question after a strike, a blocking one-tap notice:
*"You left during that question, so it scored zero. Leave once more and you
forfeit the match."* The server already returns `strikes` on every answer, so
this is client-only.

### 2. Network failure mid-question, and copy that lies

Home says **"Pull to retry"**. There is no `RefreshControl` anywhere in the
app — we instruct users to perform a gesture that does nothing.

Worse: on the question screen any failed request replaces the whole screen with
an error and two buttons, while the server-side deadline keeps running. A
network blip costs you the question and hides it while doing so.

**Fix:** implement the pull-to-refresh we already promise. On the question
screen, stop taking the screen over — keep the question and timer visible, show
an inline banner, and **auto-retry the submit**. With a server-authoritative
deadline, waiting for a human to tap "try again" is too slow to be the recovery
path.

### 3. A new user is greeted with "WELCOME BACK" and four zeros

First launch renders a stats card of `0 / 0 / 0 / 0`, no matches, no history,
under an eyebrow reading WELCOME BACK — to someone who has never played.

**Fix:** when `duelsPlayed === 0`, replace the stats card with a three-line "how
this works" card and let Quick duel be the only prominent element. Stats arrive
once there is something to show.

### 4. The sealed screen reads as broken rather than deliberate

Withheld scores render as `—`. An em-dash where a number belongs looks like
missing data, which is precisely the wrong read for a state that is
*intentionally* withholding.

**Fix:** make the withholding look designed — a sealed motif instead of a blank,
the reason stated plainly, the share action promoted to hero since "go challenge
someone" is genuinely the next step. The opponent's `answeredCount` is safe to
show and gives the eye something real. This is the natural home for the cool
accent note.

### 5. Bot results do not say where the bot came from

A duel auto-filled after 12h shows "Bot" with no explanation.

**Fix:** one line — *"Nobody claimed your duel, so the bot played it."* We are
committed to labelling bots honestly; explaining them is the same commitment.

---

## Plan

Ordered by what actually loses users, not by effort.

| | Work | Kind |
|---|---|---|
| 1 | Strike-one warning | fairness bug |
| 2 | Mid-question network recovery + real pull-to-refresh | bug |
| 3 | Timer: drop the amber stop | measured bug |
| 4 | Surface/background separation, both themes | measured bug |
| 5 | First-launch empty state | first impression |
| 6 | Sealed screen as a designed state | polish |
| 7 | Result screen as a share asset | acquisition |
| 8 | Bot provenance line | honesty |
| 9 | Resume-first, outcome in rows, selection indicator, lobby rows | polish |
| 10 | Display typeface for headings | polish |
| 11 | App icon | **ship-blocker, needs a decision** |

1–4 should happen regardless of any aesthetic direction. 5–8 are cheap and land
on states people actually hit. 9–10 are the smallest returns.

**11 needs a call from you.** An original mark in the ochre/ink palette —
abstract *S*, answer-sheet bubble row, or pencil check. Nothing resembling
official JAMB branding.

---

## Preserve these principles

- No bottom-tab navigation.
- No feature carousels or explanatory content before play.
- No cards inside cards, no dense dashboard layout.
- No multi-colour subject system.
- No illustrations, gradients, or unnecessary motion on the question screen.
- No longer signup flow.
- Green and red remain answer semantics only.

The intended product shape stays simple: open the app, choose a mode, answer
questions, see what happened.

## Review basis

Verified against the implemented Expo/React Native screens, `src/theme.ts`, the
app configuration, and the shipped assets. Contrast and hue figures are computed
from the actual token values, not estimated.

A final visual QA pass still has to happen on a physical device build —
especially text contrast, small-screen wrapping, Android font rendering, and
timer legibility in daylight.
