import { expect, test } from 'vitest';
import { createApp } from '../../src/app.js';
import { createApi } from '../../src/api/index.js';
import { dataset } from './data.js';

const forbiddenFilter = () => { throw new Error('This route must not invoke filtering'); };

test('dataset returns every supplied field unchanged without filtering or public assets', async () => {
  const app = createApp({ dataset, publicDir: '/nonexistent-radar-public' });
  const response = await app.request('/api/dataset');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(dataset);
  expect(await (await createApi(dataset, forbiddenFilter).request('/api/dataset')).json()).toEqual(dataset);
});

test('detail preserves event, related findings and every referenced source record', async () => {
  const app = createApi(dataset, forbiddenFilter);
  for (const event of dataset.events) {
    const findings = dataset.findings.filter((f) => f.eventId === event.id);
    const sourceIds = new Set(findings.map((f) => f.sourceId));
    const response = await app.request(`/api/events/${event.id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runId: dataset.runId, datasetId: dataset.datasetId,
      event, findings, sources: dataset.sources.filter((s) => sourceIds.has(s.id)) });
  }
  expect((await app.request('/api/events/absent')).status).toBe(404);
});

test('evidence preserves full provenance including role reports and rejected claims', async () => {
  const { events: _events, ...evidence } = dataset;
  const response = await createApi(dataset, forbiddenFilter).request('/api/evidence');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(evidence);
});

test('events awaits injected filtering, passes combined options and returns run identity', async () => {
  const calls: unknown[] = [];
  const app = createApi(dataset, async (events, filters) => {
    calls.push([events, filters]);
    return [events[0]];
  });
  for (const [query, options] of [
    ['', {}],
    ['?mode=online&eligibility=open&after=2026-11-12', { mode: 'online', eligibility: 'open', after: '2026-11-12' }],
  ] as const) {
    const response = await app.request(`/api/events${query}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runId: dataset.runId, datasetId: dataset.datasetId, events: [dataset.events[0]] });
    expect(calls.at(-1)).toEqual([dataset.events, options]);
  }
});

test('invalid filters return 400 without filtering; unknown API paths return 404', async () => {
  const app = createApi(dataset, forbiddenFilter);
  for (const query of ['mode=remote', 'mode=', 'eligibility=everyone', 'after=2026-02-30',
    'after=2026-2-01', 'after=nope', 'mode=online&mode=hybrid', 'extra=yes']) {
    const response = await app.request(`/api/events?${query}`);
    expect(response.status, query).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }
  expect((await app.request('/api/absent')).status).toBe(404);
});
