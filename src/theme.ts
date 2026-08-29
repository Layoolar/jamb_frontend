/**
 * SabiPass design tokens.
 *
 * One accent (ochre — pencil / exam-hall warmth, deliberately not blue or violet),
 * with green/red reserved strictly for answer semantics so the accent never
 * competes with "correct" or "wrong".
 */

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  correct: string;
  wrong: string;
  /**
   * Foreground for text sitting ON the answer surfaces. These differ by theme:
   * the dark palette's green and red are light enough to need ink, the light
   * palette's are dark enough to need white. Hardcoding either one produced a
   * failing pair in the other theme.
   */
  onCorrect: string;
  onWrong: string;
  /**
   * The one cool tone in an otherwise entirely warm palette, reserved for the
   * sealed / waiting state. Two jobs: it makes "your score is withheld" feel
   * categorically different from every other screen, and it gives the eye
   * something to push against so the ochre reads warmer by contrast.
   */
  sealed: string;
  onSealed: string;
};

/**
 * Surface sits well clear of background in both themes.
 *
 * These were previously 1.07:1 (light) and 1.09:1 (dark) — imperceptible, which
 * meant every card in the app was held up by its 1px border alone. That single
 * measurement explained most of why the interface read flat.
 *
 * Note there is no `warn` token. The timer used to run accent -> amber -> red,
 * but accent (33°) and amber (42°) are nine degrees apart, so the "you're fine"
 * to "hurry up" transition was invisible at exactly the moment it mattered.
 * The timer now runs accent -> wrong: two states, legible, and calmer than
 * three changes inside fifteen seconds.
 */
export const colors: { dark: Colors; light: Colors } = {
  dark: {
    bg: '#0E0C0A',
    surface: '#2A241D',
    surfaceAlt: '#372F27',
    border: '#453C33',
    text: '#F5F1EA',
    textMuted: '#A69B8C',
    accent: '#E0902F',
    onAccent: '#14120F',
    correct: '#3FB96B',
    wrong: '#E0503F',
    onCorrect: '#0F0D0A',
    onWrong: '#0F0D0A',
    sealed: '#7C9CB5',
    onSealed: '#0E1418',
  },
  light: {
    bg: '#E9E2D5',
    surface: '#FFFFFF',
    surfaceAlt: '#F4EFE6',
    border: '#D2C8B7',
    text: '#1E1A15',
    textMuted: '#6B6154',
    // Darker than the dark-theme accent so WHITE text clears AA on it. The
    // previous #B8701A gave 3.91 with white and 4.42 with ink — neither passed.
    accent: '#96590B',
    onAccent: '#FFFFFF',
    // Darkened from #1F8A4C, where neither ink (4.43) nor white (4.38) cleared AA.
    correct: '#1A7A43',
    wrong: '#C4372A',
    onCorrect: '#FFFFFF',
    onWrong: '#FFFFFF',
    sealed: '#3D6480',
    onSealed: '#FFFFFF',
  },
};

export type ColorScheme = keyof typeof colors;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/**
 * One display face, headings only.
 *
 * Answers and question stems deliberately stay on the SYSTEM font — Roboto on
 * Android, SF on iOS. Under a fifteen-second clock legibility is the only
 * criterion, both are excellent humanist faces, both are already on the device,
 * and neither costs a byte or risks a fallback flash. Nothing we could bundle
 * would beat them there.
 *
 * Headings are not under time pressure, and type is where most of "designed"
 * actually lives. One 72KB weight, embedded at build time, used on roughly
 * eight text nodes.
 */
export const DISPLAY_FONT = 'Fraunces_700Bold';

export const font = {
  display: {
    fontSize: 30,
    fontFamily: DISPLAY_FONT,
    letterSpacing: -0.5,
  },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  option: { fontSize: 17, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  mono: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'monospace' as const },
} as const;

/** Minimum tap target. Options are full-width and never shorter than this. */
export const TAP_TARGET = 56;

/** Per-question limit. The single most important anti-cheat control (PLAN §2.3). */
export const QUESTION_SECONDS = 15;

/** Server-side leniency for slow uploads (PLAN §3). */
export const DEADLINE_GRACE_MS = 1500;
