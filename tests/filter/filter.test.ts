import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { filterEvents } from '../../src/filter/index.js';
import type { Dataset, RadarEvent } from '../../src/types.js';

const dataset: Dataset = JSON.parse(readFileSync(new URL('../../data/research.json', import.meta.url), 'utf8'));
function event(deadline: string | null): RadarEvent {
  const result = structuredClone(dataset.events[0]!);
  result.fields.deadline = { value: deadline, status: 'verified', findingIds: [] };
  return result;
}

test('inclusive UTC boundary handles both offset directions and milliseconds', () => {
  const values = ['2026-11-11T23:59:59.999Z', '2026-11-12T00:00:00Z',
    '2026-11-12T01:00:00+01:00', '2026-11-11T23:00:00-01:00', '2026-11-12T00:01:00+01:00'];
  const events = values.map(event);
  expect(filterEvents(events, { after: '2026-11-12' })).toEqual(events.slice(1, 4));
});

test('invalid or uncertain deadlines never fall back to event dates', () => {
  for (const value of [null, '', 'November 12, 2026', '2026-02-30T00:00:00Z',
    '2026-11-12T24:01:00Z', '2026-11-12T00:00:00', '2026-11-12T00:00:00+25:00']) {
    const candidate = event(value);
    candidate.fields.eventDates.value = '2026-12-30T00:00:00Z';
    expect(filterEvents([candidate], { after: '2026-01-01' })).toEqual([]);
  }
  for (const status of ['unknown', 'conflict'] as const) {
    const candidate = event('2026-12-30T00:00:00Z');
    candidate.fields.deadline.status = status;
    expect(filterEvents([candidate], { after: '2026-01-01' })).toEqual([]);
    expect(filterEvents([candidate])).toEqual([candidate]);
  }
});

test('unknown selects uncertain categories and combines all predicates', () => {
  const events = ['verified', 'unknown', 'conflict'].map((status) => {
    const candidate = event('2026-12-01T00:00:00Z');
    candidate.fields.attendanceMode.status = status as 'verified' | 'unknown' | 'conflict';
    candidate.fields.eligibility.status = status as 'verified' | 'unknown' | 'conflict';
    return candidate;
  });
  expect(filterEvents(events, { mode: 'unknown', eligibility: 'unknown', after: '2026-12-01' })).toEqual(events.slice(1));
  expect(filterEvents(events, { mode: 'online', eligibility: 'open' })).toEqual(events.slice(0, 1));
  expect(filterEvents(events, { mode: 'unknown', eligibility: 'open' })).toEqual([]);
  const nullCategory = event(null);
  nullCategory.fields.eligibility.value = null;
  expect(filterEvents([nullCategory], { eligibility: 'unknown' })).toEqual([nullCategory]);
});

test('validates options even for an empty event list and respects leap years', () => {
  for (const options of [{ after: '1900-02-29' }, { after: '2026-04-31' }, { after: '' },
    { after: '2026-11-12T00:00:00Z' }, { after: 2026 }, { mode: null }, { eligibility: 'all' }, { extra: true }, null]) {
    expect(() => filterEvents([], options as Parameters<typeof filterEvents>[1])).toThrow(Error);
  }
  expect(filterEvents([event('2000-02-29T00:00:00Z')], { after: '2000-02-29' })).toHaveLength(1);
  expect(filterEvents([event('2026-11-12')], { after: '2026-11-12' })).toHaveLength(1);
});

test('supplied findings remain intact, ordered, and referenced by the same event objects', () => {
  const before = structuredClone(dataset.events);
  const result = filterEvents(dataset.events, { mode: 'online', eligibility: 'open', after: '2026-11-11' });
  expect(result.map((candidate) => candidate.id)).toEqual(['event-dc2e3f99c503']);
  expect(result[0]).toBe(dataset.events[0]);
  expect(filterEvents(dataset.events)).not.toBe(dataset.events);
  expect(dataset.events).toEqual(before);
  expect(filterEvents(dataset.events, { after: '2026-11-30' }).map((candidate) => candidate.id))
    .toEqual(['event-533e48bce737', 'event-a3a1819b1825']);
});
