import { describe, expect, test } from 'vitest';
import { createDoc, mergeDoc, writeField } from '../lww';
import type { LWWTimestamp } from '../types';

// Concise timestamp factory for test readability
const ts = (lamport: number, peerId: string): LWWTimestamp => ({ lamport, peerId });

// Reusable timestamps
const T1A = ts(1, 'peer-A');
const T1B = ts(1, 'peer-B');
const T2A = ts(2, 'peer-A');
const T2B = ts(2, 'peer-B');
const T3C = ts(3, 'peer-C');

// ─────────────────────────────────────────────────────────────────────────────
// Core CRDT properties
// ─────────────────────────────────────────────────────────────────────────────

describe('Idempotency — merge(A, A) ≡ A', () => {
  test('single-field doc', () => {
    const a = createDoc('note-1', T1A, { title: 'Hello' });
    expect(mergeDoc(a, a)).toEqual(a);
  });

  test('fully populated doc', () => {
    const a = createDoc('note-1', T2A, {
      title:    'My note',
      content:  '# Hello\n\nWorld',
      tags:     ['draft', 'important'],
      folderId: 'folder-xyz',
      pinned:   true,
      archived: false,
    });
    expect(mergeDoc(a, a)).toEqual(a);
  });
});

describe('Commutativity — merge(A, B) ≡ merge(B, A)', () => {
  test('causal order: later lamport wins regardless of argument order', () => {
    const older = createDoc('note-1', T1A, { title: 'First draft' });
    const newer = writeField(older, 'title', 'Second draft', T2B);

    const ab = mergeDoc(older, newer);
    const ba = mergeDoc(newer, older);

    expect(ab).toEqual(ba);
    expect(ab.fields.title.value).toBe('Second draft');
  });

  test('concurrent writes: deterministic winner, same result on both peers', () => {
    // Both peers write at lamport=1 without knowing about each other
    const onPeerA = createDoc('note-1', T1A, { title: 'Written by peer-A' });
    const onPeerB = createDoc('note-1', T1B, { title: 'Written by peer-B' });

    const resolvedOnA = mergeDoc(onPeerA, onPeerB); // peer-A receives peer-B state
    const resolvedOnB = mergeDoc(onPeerB, onPeerA); // peer-B receives peer-A state

    // Both peers arrive at the exact same document
    expect(resolvedOnA).toEqual(resolvedOnB);

    // 'peer-B' > 'peer-A' lexicographically → peer-B's value wins the tie
    expect(resolvedOnA.fields.title.value).toBe('Written by peer-B');
  });

  test('commutative for all six field types', () => {
    const a = createDoc('note-1', T1A, {
      title: 'A', content: 'contentA', tags: ['a'],
      folderId: 'f-a', pinned: true, archived: false,
    });
    const b = createDoc('note-1', T2B, {
      title: 'B', content: 'contentB', tags: ['b'],
      folderId: 'f-b', pinned: false, archived: true,
    });

    expect(mergeDoc(a, b)).toEqual(mergeDoc(b, a));
  });
});

describe('Associativity — merge(merge(A,B),C) ≡ merge(A,merge(B,C))', () => {
  test('three peers with non-overlapping edits', () => {
    const base = createDoc('note-1', T1A, {});
    const a = writeField(base, 'title',   'Title from A',   T1A);
    const b = writeField(base, 'content', 'Content from B', T2B);
    const c = writeField(base, 'tags',    ['v3'],           T3C);

    expect(mergeDoc(mergeDoc(a, b), c)).toEqual(mergeDoc(a, mergeDoc(b, c)));
  });

  test('three peers with conflicting edits on same field', () => {
    const base = createDoc('note-1', T1A, { title: 'v1' });
    const a = writeField(base, 'title', 'v2-from-A', T2A);
    const b = writeField(base, 'title', 'v2-from-B', T2B); // same lamport, peer-B wins tie
    const c = writeField(base, 'title', 'v3-from-C', T3C); // highest lamport, wins

    expect(mergeDoc(mergeDoc(a, b), c)).toEqual(mergeDoc(a, mergeDoc(b, c)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('Conflict resolution', () => {
  test('higher lamport always wins, regardless of peer identity', () => {
    const v1 = createDoc('note-1', T1B, { title: 'Old (peer-B, t=1)' });
    const v2 = writeField(v1, 'title', 'New (peer-A, t=2)', T2A);

    // peer-A has lower peerId but higher lamport — lamport is the primary key
    expect(mergeDoc(v1, v2).fields.title.value).toBe('New (peer-A, t=2)');
    expect(mergeDoc(v2, v1).fields.title.value).toBe('New (peer-A, t=2)');
  });

  test('concurrent writes (same lamport): larger peerId wins consistently', () => {
    const alpha = createDoc('note-1', ts(5, 'peer-alpha'), { content: 'alpha content' });
    const zeta  = createDoc('note-1', ts(5, 'peer-zeta'),  { content: 'zeta content'  });

    // 'peer-zeta' > 'peer-alpha' lexicographically
    expect(mergeDoc(alpha, zeta).fields.content.value).toBe('zeta content');
    expect(mergeDoc(zeta, alpha).fields.content.value).toBe('zeta content');
  });

  test('identical timestamps (same peer, same lamport) are idempotent', () => {
    const a = createDoc('note-1', T1A, { title: 'same' });
    const b = createDoc('note-1', T1A, { title: 'same' }); // independent object, same content
    expect(mergeDoc(a, b)).toEqual(a);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-field independence
// ─────────────────────────────────────────────────────────────────────────────

describe('Per-field independence', () => {
  test('each field resolves independently — different fields can have different winners', () => {
    const base = createDoc('note-1', T1A, {});

    // peer-A writes title later (t=3), peer-B writes content even later (t=4)
    const docA = writeField(base, 'title',   'Title by A (t=3)',   ts(3, 'peer-A'));
    const docB = writeField(base, 'content', 'Content by B (t=4)', ts(4, 'peer-B'));

    const merged = mergeDoc(docA, docB);
    expect(merged.fields.title.value).toBe('Title by A (t=3)');    // t=3 > t=1
    expect(merged.fields.content.value).toBe('Content by B (t=4)'); // t=4 > t=1
  });

  test('boolean fields (pinned, archived) resolve independently', () => {
    const base = createDoc('note-1', T1A, { pinned: false, archived: false });
    const pinned   = writeField(base, 'pinned',   true, T2A);
    const archived = writeField(base, 'archived', true, T2B);

    const merged = mergeDoc(pinned, archived);
    expect(merged.fields.pinned.value).toBe(true);
    expect(merged.fields.archived.value).toBe(true);
  });

  test('tags field is one atomic LWW unit (whole-field replace, not set-union)', () => {
    const base = createDoc('note-1', T1A, { tags: ['original'] });
    const addedTags     = writeField(base, 'tags', ['original', 'added'],   T2A);
    const differentTags = writeField(base, 'tags', ['completely-different'], T2B);

    // T2B wins (peer-B > peer-A lexicographically at same lamport=2)
    const merged = mergeDoc(addedTags, differentTags);
    expect(merged.fields.tags.value).toEqual(['completely-different']);
  });

  test('folderId can be set to null on one peer and a real id on another', () => {
    const base = createDoc('note-1', T1A, { folderId: 'folder-1' });
    const movedToRoot   = writeField(base, 'folderId', null,       T2A);
    const movedToFolder = writeField(base, 'folderId', 'folder-2', T2B);

    // T2B wins (peer-B lexicographically > peer-A at t=2)
    const merged = mergeDoc(movedToRoot, movedToFolder);
    expect(merged.fields.folderId.value).toBe('folder-2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-peer convergence scenario
// ─────────────────────────────────────────────────────────────────────────────

describe('Multi-peer convergence', () => {
  test('three peers converge to the same state in all 6 merge orderings', () => {
    // Starting point: all peers share the same base document
    const base = createDoc('shared-note', T1A, { title: 'Original' });

    // Each peer makes an edit without knowing about the others (concurrent)
    const stateA = writeField(base, 'title',   'Title from A',        T2A);
    const stateB = writeField(base, 'content', 'Content from B',      T2B);
    const stateC = writeField(base, 'tags',    ['reviewed', 'final'], T3C);

    // All six orderings of pairwise merge
    const r1 = mergeDoc(mergeDoc(stateA, stateB), stateC);
    const r2 = mergeDoc(mergeDoc(stateA, stateC), stateB);
    const r3 = mergeDoc(mergeDoc(stateB, stateA), stateC);
    const r4 = mergeDoc(mergeDoc(stateB, stateC), stateA);
    const r5 = mergeDoc(mergeDoc(stateC, stateA), stateB);
    const r6 = mergeDoc(mergeDoc(stateC, stateB), stateA);

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
    expect(r3).toEqual(r4);
    expect(r4).toEqual(r5);
    expect(r5).toEqual(r6);

    // Spot-check the converged values
    // title: T2A > T1A (base), T2B ties with T2A → peer-B wins tie → wait…
    // Actually stateB doesn't modify title, so title in stateB is still at T1A.
    // title: T2A (from stateA) vs T1A (from stateB/stateC base) → T2A wins
    expect(r1.fields.title.value).toBe('Title from A');
    expect(r1.fields.content.value).toBe('Content from B');    // T2B > T1A
    expect(r1.fields.tags.value).toEqual(['reviewed', 'final']); // T3C > T1A
  });

  test('late-joining fourth peer that missed all edits converges after one sync', () => {
    const base  = createDoc('note-1', T1A, { title: 'v1' });
    const stateA = writeField(base,   'title', 'v2', T2A);
    const stateB = writeField(stateA, 'title', 'v3', T2B); // peer-B wins tie at t=2

    // peer-D joins late with only the base state
    const stateD = createDoc('note-1', T1A, { title: 'v1' });

    // After one sync (peer-D receives the current merged state from any peer)
    const current = mergeDoc(stateA, stateB);
    const lateSync = mergeDoc(stateD, current);

    expect(lateSync).toEqual(current);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('Error handling', () => {
  test('merging docs with different ids throws', () => {
    const a = createDoc('note-1', T1A, {});
    const b = createDoc('note-2', T1A, {});
    expect(() => mergeDoc(a, b)).toThrow(/different ids/);
  });
});
