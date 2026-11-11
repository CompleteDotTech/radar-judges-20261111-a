import { readFileSync } from 'node:fs';
import type { Dataset, RadarEvent, ResearchField } from '../../src/types.js';

export const dataset: Dataset = JSON.parse(readFileSync(new URL('../../data/research.json', import.meta.url), 'utf8'));
export const ids = (events: RadarEvent[]) => events.map((event) => event.id);
export function field(value: string | null, status: ResearchField['status'] = 'verified'): ResearchField {
  return { value, status, findingIds: [] };
}
/** Synthetic fixtures test logic only; these are not research claims. */
export function fixture(id: string, mode: string, eligibility: string, deadline: string): RadarEvent {
  const event = structuredClone(dataset.events[0]);
  event.id = id;
  event.fields.attendanceMode = field(mode);
  event.fields.eligibility = field(eligibility);
  event.fields.deadline = field(deadline);
  return event;
}
