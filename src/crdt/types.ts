/**
 * Core CRDT types — no UI, no Tauri, no browser APIs.
 * Everything here is pure data that can live on any peer.
 */

/**
 * A Lamport timestamp paired with its author.
 *
 * Lamport value alone gives a partial causal order.
 * The peerId breaks ties deterministically so the total order is consistent
 * across every peer that runs the same merge function.
 */
export interface LWWTimestamp {
  readonly lamport: number;
  /** Stable, unique identifier for the peer that wrote this value (UUID). */
  readonly peerId: string;
}

/**
 * A single field value stored alongside the timestamp of its last write.
 * This is the atomic unit of an LWW (Last-Write-Wins) register.
 */
export interface LWWRegister<T> {
  readonly value: T;
  readonly ts: LWWTimestamp;
}

/**
 * The typed fields of a Wickerly note that participate in CRDT merge.
 *
 * Each field is tracked independently — peer-A can have a newer title while
 * peer-B has newer content, and both wins are preserved after a merge.
 *
 * Known limitation: `tags` and `content` are treated as single atomic values
 * (whole-field LWW). Concurrent edits to the same field result in one version
 * being discarded. Character-level text merging (e.g. LSEQ or RGA) and
 * set-union for tags are planned for a future phase.
 */
export type NoteFieldMap = {
  title: string;
  content: string;
  tags: readonly string[];
  folderId: string | null;
  pinned: boolean;
  archived: boolean;
};

/** The full LWW map — one register per note field. */
export type LWWFields = {
  readonly [K in keyof NoteFieldMap]: LWWRegister<NoteFieldMap[K]>;
};

/**
 * A note document represented as an LWW map.
 *
 * `id` is the stable document identity — never touched by merge.
 * `fields` is the CRDT state that gets merged across peers.
 */
export interface LWWDoc {
  readonly id: string;
  readonly fields: LWWFields;
}
