import type { Hono } from 'hono';
import type { Dataset, FilterEvents } from '../types.js';

/** API sibling owns implementation; see docs/api.md. */
export function createApi(_dataset: Dataset, _filter: FilterEvents): Hono {
  throw new Error('createApi is not implemented');
}
