import { DICT_DEF, SET_DEF } from './hashing';
import { LINKED_DEF } from './linkedlist';
import { LIST_DEF } from './list';
import { PQ_DEF } from './pq';
import { SORTED_DEF } from './sorted';
import { QUEUE_DEF, STACK_DEF } from './stackqueue';
import type { StructureDef } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyDef = StructureDef<any>;

/** Every collection the visualizer can show, by the id the lesson placements use. */
export const STRUCTURES: Record<string, AnyDef> = {
  'list-capacity': LIST_DEF,
  'linked-list': LINKED_DEF,
  'dictionary-buckets': DICT_DEF,
  'hash-set': SET_DEF,
  'sorted-dictionary': SORTED_DEF,
  stack: STACK_DEF,
  queue: QUEUE_DEF,
  'priority-queue-heap': PQ_DEF,
};
