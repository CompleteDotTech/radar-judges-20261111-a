import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { expect, test, vi } from 'vitest';
import type { Dataset, FilterEvents } from '../src/types.js';

const loaded = vi.hoisted(() => ({ api: 0, ui: 0, filter: 0, apiCreated: 0, uiCreated: 0 }));
vi.mock('../src/api/index.js', () => {
  loaded.api++;
  return { createApi: (dataset: Dataset, filter: FilterEvents) => {
    loaded.apiCreated++;
    const api = new Hono();
    api.get('/api/dataset', (c) => c.json(dataset));
    api.get('/api/events', async (c) => c.json(await filter(dataset.events, {})));
    return api;
  } };
});
vi.mock('../src/filter/index.js', () => {
  loaded.filter++;
  return { filterEvents: (events: Dataset['events']) => events };
});
vi.mock('../src/ui/index.js', () => {
  loaded.ui++;
  return { createUi: (publicDir: string) => {
    loaded.uiCreated++;
    const ui = new Hono();
    ui.get('/', (c) => c.text(publicDir));
    return ui;
  } };
});

import { createApp } from '../src/app.js';

test('scaffold exists and supplied research bytes and provenance links are intact', () => {
  for (const path of ['src/types.ts', 'src/app.ts', 'src/server.ts', 'src/api/index.ts',
    'src/filter/index.ts', 'src/ui/index.ts', 'docs/api.md', 'tests/acceptance/data.ts',
    'tests/acceptance/api.test.ts', 'tests/acceptance/ui.test.ts', 'tests/acceptance/filter.test.ts']) {
    expect(existsSync(new URL(`../${path}`, import.meta.url)), path).toBe(true);
  }
  const bytes = readFileSync(new URL('../data/research.json', import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('a6125ac7860ef3c16caa2d6ba9f327766b529fb2f49044e4399b886ce2fefca4');
  const dataset: Dataset = JSON.parse(bytes.toString());
  expect(dataset.schemaVersion).toBe(1);
  expect(dataset.events.length).toBeGreaterThan(0);
  const findings = new Map(dataset.findings.map((f) => [f.id, f]));
  const sources = new Set(dataset.sources.map((s) => s.id));
  for (const event of dataset.events) for (const field of Object.values(event.fields)) {
    for (const id of field.findingIds) {
      expect(findings.get(id)?.eventId).toBe(event.id);
      expect(sources.has(findings.get(id)!.sourceId)).toBe(true);
    }
  }
  expect(readFileSync(new URL('../docs/api.md', import.meta.url), 'utf8')).toContain('radar:<runId>:shortlist');
});

test('app lazily loads and caches sibling routers; dataset does not initialize UI or filter', async () => {
  expect(loaded).toEqual({ api: 0, ui: 0, filter: 0, apiCreated: 0, uiCreated: 0 });
  const dataset: Dataset = JSON.parse(readFileSync(new URL('../data/research.json', import.meta.url), 'utf8'));
  const app = createApp({ dataset, publicDir: '/test-public' });
  expect(loaded.api).toBe(0);
  expect(await (await app.request('/api/dataset')).json()).toEqual(dataset);
  expect(loaded).toEqual({ api: 1, ui: 0, filter: 0, apiCreated: 1, uiCreated: 0 });
  expect((await app.request('/api/missing')).status).toBe(404);
  expect(loaded.ui).toBe(0);
  expect(await (await app.request('/api/events')).json()).toEqual(dataset.events);
  expect(loaded.filter).toBe(1);
  expect(await (await app.request('/')).text()).toBe('/test-public');
  await app.request('/');
  expect(loaded).toEqual({ api: 1, ui: 1, filter: 1, apiCreated: 1, uiCreated: 1 });
});
