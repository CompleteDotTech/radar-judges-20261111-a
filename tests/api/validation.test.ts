import { expect, test, vi } from 'vitest';
import { createApi } from '../../src/api/index.js';
import { dataset } from '../acceptance/data.js';

test('rejects empty, repeated, unknown and impossible filters before invoking dependency', async () => {
  const filter = vi.fn(() => dataset.events);
  const app = createApi(dataset, filter);
  for (const query of [
    'eligibility=', 'after=', 'mode=all',
    'eligibility=all', 'eligibility=remote',
    'eligibility=open&eligibility=open', 'after=2026-01-01&after=2026-01-01',
    'after=2025-02-29', 'after=1900-02-29', 'after=2026-04-31',
    'after=2026-00-01', 'after=2026-13-01', 'after=2026-01-00',
    'after=2026-01-01T00:00:00Z', 'unknown=',
  ]) {
    const response = await app.request(`/api/events?${query}`);
    expect(response.status, query).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }
  expect(filter).not.toHaveBeenCalled();
});

test('accepts leap days and all documented filter values without normalizing options', async () => {
  const filter = vi.fn(async () => []);
  const app = createApi(dataset, filter);
  for (const mode of ['online', 'in-person', 'hybrid', 'unknown']) {
    for (const eligibility of ['open', 'student-only', 'students', 'unknown']) {
      const response = await app.request(`/api/events?mode=${mode}&eligibility=${eligibility}&after=2000-02-29`);
      expect(response.status).toBe(200);
      expect(filter).toHaveBeenLastCalledWith(dataset.events, { mode, eligibility, after: '2000-02-29' });
    }
  }
});

test('non-list routes ignore query filters and unknown routes return JSON errors', async () => {
  const filter = vi.fn(() => dataset.events);
  const app = createApi(dataset, filter);
  for (const path of ['/api/dataset', '/api/evidence', `/api/events/${dataset.events[0].id}`]) {
    expect((await app.request(`${path}?mode=invalid`)).status).toBe(200);
  }
  for (const path of ['/api/missing', '/api/events/absent', '/api/events/absent/extra']) {
    const response = await app.request(path);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }
  expect(filter).not.toHaveBeenCalled();
});
