import type { EventFilters, RadarEvent } from '../types.js';

/** Filter sibling owns implementation; see docs/api.md. */
export function filterEvents(_events: RadarEvent[], _filters: EventFilters = {}): RadarEvent[] {
  throw new Error('filterEvents is not implemented');
}
