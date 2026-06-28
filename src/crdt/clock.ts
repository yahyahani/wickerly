import type { LWWTimestamp } from './types';

/**
 * Total order over LWW timestamps.
 *
 * Primary key:   lamport value (higher = causally later or concurrent-and-lucky)
 * Tiebreaker:    lexicographic comparison of peerId strings
 *
 * The tiebreaker is arbitrary but stable: every peer that applies the same
 * comparison always picks the same winner for a given pair of timestamps.
 * This guarantees that merge is commutative and deterministic without
 * requiring any coordination between peers.
 *
 * Returns: 1 if a > b, -1 if a < b, 0 if identical.
 */
export function cmpTs(a: LWWTimestamp, b: LWWTimestamp): -1 | 0 | 1 {
  if (a.lamport !== b.lamport) return a.lamport > b.lamport ? 1 : -1;
  if (a.peerId  !== b.peerId)  return a.peerId  > b.peerId  ? 1 : -1;
  return 0;
}

/**
 * Advance a local Lamport clock after a local write event.
 * Monotonically increases; never goes backwards.
 */
export function tick(lamport: number): number {
  return lamport + 1;
}

/**
 * Advance a local clock after receiving a remote message carrying `received`.
 *
 * Per the Lamport clock rule:
 *   local := max(local, received) + 1
 *
 * This ensures the new local value is strictly greater than both, preserving
 * the "happened-before" invariant for any subsequent local event.
 */
export function advance(local: number, received: number): number {
  return Math.max(local, received) + 1;
}
