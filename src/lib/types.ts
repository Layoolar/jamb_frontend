/**
 * Mirrors the backend response schemas (jamb_backend/src/schemas/index.ts).
 *
 * Note what ServedQuestion does NOT have: correctIndex or explanation. The
 * server strips them, and the client has no type for them either, so a
 * "just read it from the payload" shortcut cannot compile.
 */

export type PublicUser = {
  id: string;
  username: string;
  avatarSeed: string;
  isBot: boolean;
};

export type Stats = {
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  duelsPlayed: number;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
  isNewAccount: boolean;
};

export type Me = {
  user: PublicUser;
  email: string;
  stats: Stats;
  linkedProviders: ('google' | 'apple')[];
  hasPassword: boolean;
};

export type MatchMode = 'duel' | 'solo';
export type MatchStatus =
  | 'awaiting_opponent'
  | 'in_progress'
  | 'settled'
  | 'expired';

export type MatchSummary = {
  matchId: string;
  mode: MatchMode;
  status: MatchStatus;
  subject: { slug: string; name: string } | null;
  inviteCode: string | null;
  totalQuestions: number;
  answeredCount: number;
  expiresAt: string;
  /** Null until a duel settles — the match list obeys the same seal as the result. */
  outcome: 'won' | 'lost' | 'draw' | null;
  yourScore: number | null;
  opponentScore: number | null;
  opponentName: string | null;
};

export type ServedQuestion = {
  qIndex: number;
  totalQuestions: number;
  questionId: string;
  stem: string;
  options: string[];
  contentFormat: 'plain' | 'latex';
  subject: string;
  year: number | null;
  deadlineAt: string;
  serverNow: string;
};

export type AnswerResult = {
  /** False during a duel: you learn nothing until the match settles. */
  revealed: boolean;
  isCorrect: boolean | null;
  correctIndex: number | null;
  explanation: string | null;
  points: number | null;
  runningScore: number | null;
  msTaken: number;
  wasLate: boolean;
  qIndex: number;
  isFinalQuestion: boolean;
  strikes: number;
  forfeited: boolean;
};

export type PlayerLine = {
  user: PublicUser;
  /** Null until MatchResult.revealed. */
  score: number | null;
  totalMs: number | null;
  answeredCount: number;
  forfeited: boolean;
  finished: boolean;
};

export type AnswerLine = {
  selectedIndex: number | null;
  isCorrect: boolean | null;
  msTaken: number | null;
  points: number;
};

export type MatchResult = {
  matchId: string;
  status: MatchStatus;
  mode: MatchMode;
  totalQuestions: number;
  /** Only present for the creator, and only while the duel is still open. */
  inviteCode: string | null;
  subject: { slug: string; name: string } | null;
  isDraw: boolean;
  isBotOpponent: boolean;
  winnerId: string | null;
  /** True once scores and keys may be shown; `questions` is empty until then. */
  revealed: boolean;
  you: PlayerLine;
  opponent: PlayerLine | null;
  questions: {
    qIndex: number;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
    yours: AnswerLine | null;
    theirs: AnswerLine | null;
  }[];
};

export type Subject = {
  slug: string;
  name: string;
  /** Counts are per-pool — the pools are disjoint, so a subject can be
   *  playable in one mode and not the other. */
  duelQuestions: number;
  practiceQuestions: number;
};

export type IntegrityFlag = {
  kind: 'app_away' | 'screenshot' | 'split_screen';
  msAway?: number;
};
