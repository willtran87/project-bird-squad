import { narrativeThreads, type LeaderThreads } from './narrative-content';
import { hashSeed } from './route-gen';

/**
 * Picks narrative beats from `narrative-content.ts`. Every pick is a pure
 * function of the run seed, so a flight reads the same on resume, in the
 * recap and for everyone flying the same Daily Flight.
 */

const FALLBACK_LEADER = 'fledgling';

function threadsFor(leaderId: string | undefined): LeaderThreads {
  return narrativeThreads[leaderId ?? ''] ?? narrativeThreads[FALLBACK_LEADER];
}

function pick(lines: readonly string[], key: string, salt: number): string {
  return lines.length ? lines[hashSeed(key, salt) % lines.length] : '';
}

/** The Leader's line on entering `district` (0-based, in flight order). */
export function districtArrivalLine(seed: string, leaderId: string | undefined, district: number): string {
  const arrivals = threadsFor(leaderId).arrivals;
  const index = Math.max(0, Math.min(arrivals.length - 1, Math.floor(Number.isFinite(district) ? district : 0)));
  return pick(arrivals[index], `${seed}:thread:${leaderId ?? FALLBACK_LEADER}:${index}`, 0x7ead + index);
}

/** The closing line for a finished flight; names the last district reached. */
export function closingLine(seed: string, leaderId: string | undefined, result: 'win' | 'loss', districtName: string): string {
  const lines = threadsFor(leaderId).closings[result === 'win' ? 'win' : 'loss'];
  return pick(lines, `${seed}:closing:${leaderId ?? FALLBACK_LEADER}:${result}`, 0xc105e).replace(/\{district\}/g, districtName);
}
