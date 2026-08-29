/**
 * Server-clock alignment.
 *
 * The server owns the deadline, but the countdown renders locally. If the
 * phone's clock is off — and on cheap Android hardware it often is by seconds —
 * a naive `deadline - Date.now()` shows the wrong time remaining, and the player
 * either loses time they had or sees a timer that never reaches zero.
 *
 * Every served question carries `serverNow`, so we can measure the offset once
 * per question and render against corrected time.
 */

export type ServerClock = {
  /** Add this to Date.now() to get server time. */
  offsetMs: number;
  deadlineMs: number;
};

export function makeClock(deadlineAt: string, serverNow: string): ServerClock {
  const server = new Date(serverNow).getTime();
  return {
    offsetMs: server - Date.now(),
    deadlineMs: new Date(deadlineAt).getTime(),
  };
}

/** Milliseconds left, never negative. */
export function remainingMs(clock: ServerClock): number {
  return Math.max(0, clock.deadlineMs - (Date.now() + clock.offsetMs));
}
