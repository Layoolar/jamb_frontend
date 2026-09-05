import Constants from 'expo-constants';
import {
  clearSession,
  loadSession,
  saveSession,
  updateTokens,
  type Session,
} from './session';
import type {
  AnswerResult,
  AuthResult,
  IntegrityFlag,
  MatchResult,
  MatchSummary,
  Me,
  PublicUser,
  ReportReason,
  ServedQuestion,
  Subject,
} from './types';

/**
 * API base URL.
 *
 * A physical device cannot reach `localhost` — that is the phone's own loopback.
 * Set EXPO_PUBLIC_API_URL to your machine's LAN address (e.g.
 * http://192.168.1.20:4000). We fall back to the packager host, which is
 * usually the right machine during development.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;

  return 'http://localhost:4000';
}

export const API_BASE = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthenticated: (() => void) | null = null;

/** Lets the app drop back to the sign-in screen when refresh fails for good. */
export function setUnauthenticatedHandler(fn: () => void): void {
  onUnauthenticated = fn;
}

/**
 * Single-flight refresh. Several requests can 401 at once; without this they
 * would each rotate the refresh token, and rotation treats a second use of the
 * same token as a leak and revokes the whole family — logging the user out.
 */
let refreshing: Promise<Session | null> | null = null;

async function refreshOnce(): Promise<Session | null> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const current = await loadSession();
      if (!current) return null;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (!res.ok) {
        await clearSession();
        onUnauthenticated?.();
        return null;
      }

      const next = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await updateTokens(next.accessToken, next.refreshToken);
      return { ...current, ...next };
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

type CallOpts = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
};

async function call<T>(path: string, opts: CallOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const session = auth ? await loadSession() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && auth && !opts._retried) {
    const refreshed = await refreshOnce();
    if (refreshed) return call<T>(path, { ...opts, _retried: true });
  }

  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const e = (parsed ?? {}) as {
      code?: string;
      message?: string;
      fields?: { path: string; message: string }[];
    };
    throw new ApiError(
      res.status,
      e.code ?? 'unknown',
      e.message ?? 'Something went wrong. Try again.',
      e.fields,
    );
  }

  return parsed as T;
}

// ---------------------------------------------------------------------- auth

export const api = {
  async signup(email: string, password: string): Promise<AuthResult> {
    const r = await call<AuthResult>('/auth/signup', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await saveSession({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      user: r.user,
    });
    return r;
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const r = await call<AuthResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await saveSession({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      user: r.user,
    });
    return r;
  },

  async oauth(provider: 'google' | 'apple', idToken: string): Promise<AuthResult> {
    const r = await call<AuthResult>(`/auth/oauth/${provider}`, {
      method: 'POST',
      body: { idToken },
      auth: false,
    });
    await saveSession({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      user: r.user,
    });
    return r;
  },

  /**
   * Returns a FRESH token pair — the server revokes every session on change,
   * including this one. Store the result or the next request 401s.
   */
  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    call<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/password/change',
      { method: 'POST', body: { currentPassword, newPassword } },
    ),

  forgotPassword: (email: string) =>
    call<{ ok: true }>('/auth/password/forgot', {
      method: 'POST',
      body: { email },
      auth: false,
    }),

  resetPassword: (code: string, password: string) =>
    call<{ ok: true }>('/auth/password/reset', {
      method: 'POST',
      body: { code, password },
      auth: false,
    }),

  me: () => call<Me>('/auth/me'),

  setUsername: (username: string) =>
    call<PublicUser>('/auth/username', { method: 'POST', body: { username } }),

  async logout(): Promise<void> {
    try {
      await call('/auth/logout', { method: 'POST' });
    } finally {
      await clearSession();
    }
  },

  async deleteAccount(): Promise<void> {
    try {
      await call('/auth/account', { method: 'DELETE' });
    } finally {
      await clearSession();
    }
  },

  // ------------------------------------------------------------------ content

  subjects: () => call<{ subjects: Subject[] }>('/subjects', { auth: false }),

  reportQuestion: (questionId: string, reason: string) =>
    call<{ ok: true }>(`/questions/${questionId}/report`, {
      method: 'POST',
      body: { reason },
    }),

  // --------------------------------------------------------------- moderation

  blockedUsers: () => call<{ blocked: PublicUser[] }>('/users/blocked'),

  blockUser: (userId: string) =>
    call<{ ok: true }>(`/users/${userId}/block`, { method: 'POST' }),

  unblockUser: (userId: string) =>
    call<{ ok: true }>(`/users/${userId}/block`, { method: 'DELETE' }),

  /** Reporting also blocks server-side — the two are one action to the user. */
  reportUser: (userId: string, input: { reason: ReportReason; matchId?: string }) =>
    call<{ ok: true }>(`/users/${userId}/report`, { method: 'POST', body: input }),

  // ------------------------------------------------------------------ matches

  myMatches: () => call<{ matches: MatchSummary[] }>('/matches'),

  createMatch: (subjectSlug: string | undefined, mode: 'duel' | 'solo') =>
    call<MatchSummary>('/matches', { method: 'POST', body: { subjectSlug, mode } }),

  joinMatch: (opts: { inviteCode?: string; subjectSlug?: string }) =>
    call<MatchSummary>('/matches/join', { method: 'POST', body: opts }),

  serveQuestion: (matchId: string) =>
    call<ServedQuestion>(`/matches/${matchId}/question`, { method: 'POST' }),

  submitAnswer: (
    matchId: string,
    questionId: string,
    selectedIndex: number | null,
    flags: IntegrityFlag[],
  ) =>
    call<AnswerResult>(`/matches/${matchId}/answer`, {
      method: 'POST',
      body: { questionId, selectedIndex, flags },
    }),

  addBot: (matchId: string) =>
    call<MatchSummary>(`/matches/${matchId}/bot`, { method: 'POST' }),

  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    call<{ ok: true }>('/auth/push-token', {
      method: 'POST',
      body: { token, platform },
    }),

  matchResult: (matchId: string) =>
    call<MatchResult>(`/matches/${matchId}/result`),
};
