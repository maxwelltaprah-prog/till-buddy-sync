// Detects a wrong computer clock. When a device clock is far off, sign-in tokens look
// expired immediately, the app refreshes them in a loop, hits the rate limit and signs out.
export const CLOCK_SKEW_LIMIT_SECONDS = 5 * 60;
export const CLOCK_SKEW_KEY = 'imax_clock_skew_seconds';

/** Seconds the local clock is ahead (+) or behind (-) the server, from a JWT's `iat`. */
export function clockSkewSeconds(accessToken: string, nowMs: number = Date.now()): number | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.iat !== 'number') return null;
    return Math.round(nowMs / 1000 - payload.iat);
  } catch {
    return null;
  }
}

export function describeSkew(seconds: number): string {
  const mins = Math.round(Math.abs(seconds) / 60);
  const amount = mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
  return `This computer's clock is ${amount} ${seconds > 0 ? 'ahead' : 'behind'}. Turn on automatic date, time and time zone (Windows: Settings > Time & language. Mac: System Settings > General > Date & Time), then sign in again.`;
}
