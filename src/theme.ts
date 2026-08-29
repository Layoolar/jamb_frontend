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
  warn: string;
};

export const colors: { dark: Colors; light: Colors } = {
  dark: {
    bg: '#14120F',
    surface: '#1F1B16',
    surfaceAlt: '#2A2520',
    border: '#3A332B',
    text: '#F5F1EA',
    textMuted: '#A69B8C',
    accent: '#E0902F',
    onAccent: '#14120F',
    correct: '#3FB96B',
    wrong: '#E0503F',
    warn: '#E0B03F',
  },
  light: {
    bg: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F2EDE4',
    border: '#DDD5C8',
    text: '#1E1A15',
    textMuted: '#6B6154',
    accent: '#B8701A',
    onAccent: '#FFFFFF',
    correct: '#1F8A4C',
    wrong: '#C4372A',
    warn: '#9A6B12',
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

export const font = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5 },
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
