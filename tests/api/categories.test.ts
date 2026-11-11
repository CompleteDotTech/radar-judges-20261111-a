import { expect, test } from 'vitest';
import { createApi } from '../../src/api/index.js';
import { filterEvents } from '../../src/filter/index.js';
import { dataset, fixture, field, ids } from '../acceptance/data.js';

test('canonical student-only and its input alias select verified research without changing it', async () => {
  const student = fixture('student', 'online', 'student-only', '2026-12-01T00:00:00Z');
  const open = fixture('open', 'hybrid', 'open', '2026-12-01T00:00:00Z');
  const uncertain = ['unknown', 'conflicting', 'conflict'].map((status) => {
    const event = structuredClone(student);
    event.id = status;
    event.fields.eligibility = field('student-only', status as 'unknown' | 'conflicting' | 'conflict');
    event.fields.attendanceMode = field('online', status as 'unknown' | 'conflicting' | 'conflict');
    return event;
  });
  const missing = structuredClone(student);
  missing.id = 'missing';
  missing.fields.eligibility = field(null);
  missing.fields.attendanceMode = field(null);
  const events = [student, open, ...uncertain, missing];
  const research = { ...dataset, events };
  const before = structuredClone(research);
  const app = createApi(research, filterEvents);
  for (const [category, expected] of [
    ['student-only', ['student']], ['students', ['student']], ['open', ['open']],
    ['unknown', ['unknown', 'conflicting', 'conflict', 'missing']],
  ] as const) {
    expect(ids(filterEvents(events, { eligibility: category }))).toEqual(expected);
    const response = await app.request(`/api/events?eligibility=${category}`);
    expect(response.status).toBe(200);
    expect(ids((await response.json()).events)).toEqual(expected);
  }
  for (const [mode, expected] of [
    ['online', ['student']], ['hybrid', ['open']], ['in-person', []],
    ['unknown', ['unknown', 'conflicting', 'conflict', 'missing']],
  ] as const) {
    expect(ids(filterEvents(events, { mode }))).toEqual(expected);
    const response = await app.request(`/api/events?mode=${mode}`);
    expect(response.status).toBe(200);
    expect(ids((await response.json()).events)).toEqual(expected);
  }
  expect(await (await app.request('/api/dataset')).json()).toEqual(before);
  expect(research).toEqual(before);
  expect(filterEvents(events, { eligibility: 'students' })[0]).toBe(student);
});
