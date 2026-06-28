import { cmpTs } from './clock';
import type {
  LWWDoc,
  LWWFields,
  LWWRegister,
  LWWTimestamp,
  NoteFieldMap,
} from './types';

/**
 * Merge two registers for the same field.
 *
 * The register with the later timestamp (per cmpTs) wins.
 * If both timestamps are identical the result is the same regardless of
 * argument order — commutativity is trivially preserved.
 */
export function mergeRegister<T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>,
): LWWRegister<T> {
  return cmpTs(a.ts, b.ts) >= 0 ? a : b;
}

/**
 * Create a fresh LWW document.
 * All fields are stamped with the same timestamp — the moment of creation.
 *
 * @param id        Stable, globally-unique document identity (note id).
 * @param ts        Logical timestamp of this creation event on the creating peer.
 * @param initial   Optional initial field values (defaults: empty strings / false / null).
 */
export function createDoc(
  id: string,
  ts: LWWTimestamp,
  initial: Partial<NoteFieldMap> = {},
): LWWDoc {
  const reg = <T>(value: T): LWWRegister<T> => ({ value, ts });
  return {
    id,
    fields: {
      title:    reg(initial.title    ?? ''),
      content:  reg(initial.content  ?? ''),
      tags:     reg(initial.tags     ?? []),
      folderId: reg(initial.folderId ?? null),
      pinned:   reg(initial.pinned   ?? false),
      archived: reg(initial.archived ?? false),
    },
  };
}

/**
 * Return a new document with one field updated at the given timestamp.
 * The document itself is treated as immutable — a new object is returned.
 *
 * The caller is responsible for providing a `ts` whose lamport value is
 * strictly greater than the peer's previous clock (i.e. the result of `tick`
 * or `advance` from clock.ts).
 */
export function writeField<K extends keyof NoteFieldMap>(
  doc: LWWDoc,
  field: K,
  value: NoteFieldMap[K],
  ts: LWWTimestamp,
): LWWDoc {
  return {
    ...doc,
    fields: { ...doc.fields, [field]: { value, ts } } as LWWFields,
  };
}

/**
 * Merge two replicas of the same document into a single converged document.
 *
 * Each field is merged independently using its LWW register — the field with
 * the later timestamp wins, with peerId as a deterministic tiebreaker.
 *
 * Mathematical properties (proven by the tests):
 *   Commutative:  merge(a, b) ≡ merge(b, a)
 *   Idempotent:   merge(a, a) ≡ a
 *   Associative:  merge(merge(a, b), c) ≡ merge(a, merge(b, c))
 *
 * Together these three properties make this a valid state-based CRDT (CvRDT).
 * They guarantee that any set of peers will converge to the same state
 * regardless of the order in which they exchange their local states.
 *
 * @throws if `a.id !== b.id` — merging different documents is a programming error.
 */
export function mergeDoc(a: LWWDoc, b: LWWDoc): LWWDoc {
  if (a.id !== b.id) {
    throw new Error(
      `Cannot merge docs with different ids: "${a.id}" vs "${b.id}"`,
    );
  }
  return {
    id: a.id,
    fields: {
      title:    mergeRegister(a.fields.title,    b.fields.title),
      content:  mergeRegister(a.fields.content,  b.fields.content),
      tags:     mergeRegister(a.fields.tags,     b.fields.tags),
      folderId: mergeRegister(a.fields.folderId, b.fields.folderId),
      pinned:   mergeRegister(a.fields.pinned,   b.fields.pinned),
      archived: mergeRegister(a.fields.archived, b.fields.archived),
    },
  };
}
