import type { EventFilters, RadarEvent, ResearchField } from '../types.js';

/** Shared API and pure-filter options. */
export type EvidenceFilters = EventFilters;

const modes = ['online', 'in-person', 'hybrid'];
const eligibilities = ['open', 'student-only'];

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

function deadlineInstant(value: string | null): number {
  if (value === null) return NaN;
  // Require ISO syntax and a real calendar date; Date.parse alone normalizes
  // impossible dates and accepts non-ISO strings. Times need an explicit zone.
  if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)
      || !calendarDate(value.slice(0, 10))) return NaN;
  return Date.parse(value);
}

function categoryMatches(field: ResearchField | undefined, selection: string | undefined, categories: string[]): boolean {
  if (selection === undefined) return true;
  const known = field?.status === 'verified' && field.value !== null && categories.includes(field.value);
  return selection === 'unknown' ? !known : known && field?.value === selection;
}

/** Combine evidence-backed predicates, retaining the original objects and order. */
export function filterEvents(events: RadarEvent[], filters: EvidenceFilters = {}): RadarEvent[] {
  if (filters === null || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new Error('Invalid filter options');
  }
  for (const key of Object.keys(filters)) {
    if (!['mode', 'eligibility', 'after'].includes(key)) throw new Error(`Unknown filter: ${key}`);
  }
  const { mode, eligibility, after } = filters;
  if (mode !== undefined && ![...modes, 'unknown'].includes(mode)) throw new Error('Invalid mode');
  if (eligibility !== undefined && ![...eligibilities, 'students', 'unknown'].includes(eligibility)) throw new Error('Invalid eligibility');
  if (after !== undefined && (typeof after !== 'string' || !calendarDate(after))) throw new Error('Invalid after date');
  const boundary = after === undefined ? undefined : Date.parse(`${after}T00:00:00.000Z`);

  return events.filter((event) => categoryMatches(event.fields.attendanceMode, mode, modes)
    && categoryMatches(event.fields.eligibility, eligibility === 'students' ? 'student-only' : eligibility, eligibilities)
    && (boundary === undefined || (event.fields.deadline.status === 'verified'
      && deadlineInstant(event.fields.deadline.value) >= boundary)));
}
