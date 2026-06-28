export type {
  LWWDoc,
  LWWFields,
  LWWRegister,
  LWWTimestamp,
  NoteFieldMap,
} from './types';

export { cmpTs, tick, advance } from './clock';
export { createDoc, writeField, mergeDoc, mergeRegister } from './lww';
