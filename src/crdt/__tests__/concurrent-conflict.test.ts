import { describe, test, expect } from 'vitest';
import { createDoc, writeField, mergeDoc } from '../lww';

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Concurrent per-field conflict resolution
//
// Two peers start from the same base document, independently edit *different*
// fields, then sync.  After merging, the result must contain both peers'
// changes — neither write is lost.  This directly validates the core guarantee
// of the LWW Map CRDT: per-field independence means only true conflicts on the
// *same* field require a tiebreaker; edits on separate fields always coexist.
// ─────────────────────────────────────────────────────────────────────────────

describe('concurrent per-field conflict resolution (Test 2)', () => {

  test('peer A edits content, peer B edits tags — both survive the merge', () => {
    // ── Shared starting state ───────────────────────────────────────────────
    const base = createDoc('note-shared', { lamport: 1, peerId: 'origin' }, {
      title:    'Shared note',
      content:  'original content',
      tags:     ['draft'],
      folderId: null,
      pinned:   false,
      archived: false,
    });

    // ── Independent diverging writes (same Lamport, different peers) ────────
    // Peer A goes offline and edits the content field.
    const docA = writeField(base, 'content', 'content written by A', { lamport: 2, peerId: 'peer-A' });

    // Peer B, simultaneously, adds a tag.
    const docB = writeField(base, 'tags', ['draft', 'important'], { lamport: 2, peerId: 'peer-B' });

    // ── Merge in both orders (must be commutative) ──────────────────────────
    const mergedAB = mergeDoc(docA, docB);
    const mergedBA = mergeDoc(docB, docA);

    // Content from A survives
    expect(mergedAB.fields.content.value).toBe('content written by A');
    expect(mergedBA.fields.content.value).toBe('content written by A');

    // Tags from B survive
    expect(mergedAB.fields.tags.value).toEqual(['draft', 'important']);
    expect(mergedBA.fields.tags.value).toEqual(['draft', 'important']);

    // Unedited fields are unchanged
    expect(mergedAB.fields.title.value).toBe('Shared note');
    expect(mergedAB.fields.pinned.value).toBe(false);
  });

  test('same-field conflict: higher Lamport wins, lower Lamport is discarded', () => {
    const base = createDoc('note-conflict', { lamport: 1, peerId: 'origin' }, {
      title: 'title', content: 'original', tags: [], folderId: null, pinned: false, archived: false,
    });

    // Both peers edit the same content field; B's write is causally later
    const docA = writeField(base, 'content', 'A wrote this at lamport 3', { lamport: 3, peerId: 'peer-A' });
    const docB = writeField(base, 'content', 'B wrote this at lamport 5', { lamport: 5, peerId: 'peer-B' });

    const merged = mergeDoc(docA, docB);
    expect(merged.fields.content.value).toBe('B wrote this at lamport 5');
  });

  test('three peers each edit a different field — all three writes survive', () => {
    const base = createDoc('note-three', { lamport: 1, peerId: 'origin' }, {
      title:    'original title',
      content:  'original content',
      tags:     [],
      folderId: null,
      pinned:   false,
      archived: false,
    });

    const docA = writeField(base, 'title',   'A edited the title',   { lamport: 2, peerId: 'peer-A' });
    const docB = writeField(base, 'content', 'B edited the content', { lamport: 2, peerId: 'peer-B' });
    const docC = writeField(base, 'tags',    ['final'],              { lamport: 2, peerId: 'peer-C' });

    // Merge in one order
    const merged = mergeDoc(mergeDoc(docA, docB), docC);
    expect(merged.fields.title.value).toBe('A edited the title');
    expect(merged.fields.content.value).toBe('B edited the content');
    expect(merged.fields.tags.value).toEqual(['final']);

    // Merge in reverse order — associativity + commutativity guarantee same result
    const mergedReverse = mergeDoc(docA, mergeDoc(docB, docC));
    expect(mergedReverse.fields.title.value).toBe('A edited the title');
    expect(mergedReverse.fields.content.value).toBe('B edited the content');
    expect(mergedReverse.fields.tags.value).toEqual(['final']);
  });

  test('base-state field untouched by either peer stays at its original value', () => {
    const base = createDoc('note-untouched', { lamport: 1, peerId: 'origin' }, {
      title: 'untouched title', content: 'body', tags: [], folderId: 'folder-1', pinned: false, archived: false,
    });

    const docA = writeField(base, 'content', 'A changed content', { lamport: 2, peerId: 'peer-A' });
    const docB = writeField(base, 'pinned',  true,                { lamport: 2, peerId: 'peer-B' });

    const merged = mergeDoc(docA, docB);

    // Neither peer touched title or folderId — they must be intact
    expect(merged.fields.title.value).toBe('untouched title');
    expect(merged.fields.folderId.value).toBe('folder-1');
  });
});
