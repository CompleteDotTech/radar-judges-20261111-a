import { expect, test } from 'vitest';
import { filterEvents } from '../../src/filter/index.js';
import type { AttendanceMode, Eligibility } from '../../src/types.js';
import { dataset, field, fixture, ids } from './data.js';

test('mode and eligibility combinations use AND, preserve order and do not mutate', () => {
  const modes: AttendanceMode[] = ['online', 'in-person', 'hybrid'];
  const eligibilities: Eligibility[] = ['open', 'students'];
  const events = modes.flatMap((m) => eligibilities.map((e) => fixture(`${m}-${e}`, m, e, '2026-12-01T00:00:00Z')));
  const before = structuredClone(events);
  for (const mode of [undefined, ...modes]) for (const eligibility of [undefined, ...eligibilities]) {
    for (const after of [undefined, '2026-12-01', '2026-12-02']) {
      const expected = before.filter((e) => (!mode || e.fields.attendanceMode.value === mode)
        && (!eligibility || e.fields.eligibility.value === eligibility) && after !== '2026-12-02');
      expect(ids(filterEvents(events, { mode, eligibility, after }))).toEqual(ids(expected));
    }
  }
  expect(events).toEqual(before);
  expect(filterEvents(events)).not.toBe(events);
});

test('after includes UTC midnight, handles offsets and excludes earlier or invalid deadlines', () => {
  const events = [
    fixture('before', 'online', 'open', '2026-11-11T23:59:59Z'),
    fixture('equal', 'online', 'open', '2026-11-12T00:00:00Z'),
    fixture('offset-before', 'online', 'open', '2026-11-12T00:30:00+01:00'),
    fixture('offset-after', 'online', 'open', '2026-11-11T23:30:00-01:00'),
    fixture('invalid', 'online', 'open', 'not-a-date'),
  ];
  expect(ids(filterEvents(events, { after: '2026-11-12' }))).toEqual(['equal', 'offset-after']);
});

test('uncertain fields are excluded only when constrained; supplied unknowns stay unknown', () => {
  for (const status of ['unknown', 'conflict'] as const) {
    const event = fixture(status, 'online', 'open', '2026-12-01T00:00:00Z');
    event.fields.attendanceMode = field('online', status);
    event.fields.eligibility = field('open', status);
    event.fields.deadline = field('2026-12-01T00:00:00Z', status);
    expect(ids(filterEvents([event], {}))).toEqual([status]);
    for (const options of [{ mode: 'online' as const }, { eligibility: 'open' as const }, { after: '2026-11-12' }]) {
      expect(filterEvents([event], options)).toEqual([]);
    }
  }
  const nullEvent = fixture('null', 'online', 'open', '2026-12-01T00:00:00Z');
  nullEvent.fields.deadline = field(null, 'unknown');
  expect(filterEvents([nullEvent], { after: '2026-11-12' })).toEqual([]);
  expect(ids(filterEvents(dataset.events, { eligibility: 'open' }))).toEqual(
    dataset.events.filter((e) => e.fields.eligibility.status === 'verified' && e.fields.eligibility.value === 'open').map((e) => e.id),
  );
});

test('invalid filter options throw instead of silently returning misleading matches', () => {
  for (const options of [{ mode: 'remote' }, { eligibility: '' }, { after: '2026-02-30' }, { after: '2026-2-01' }]) {
    expect(() => filterEvents([], options as Parameters<typeof filterEvents>[1])).toThrow();
  }
});
