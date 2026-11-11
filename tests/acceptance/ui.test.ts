import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { createApp } from '../../src/app.js';
import type { CreateShortlist } from '../../src/types.js';
import { dataset } from './data.js';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));
async function shortlistModule(): Promise<{ createShortlist: CreateShortlist }> {
  return import(/* @vite-ignore */ pathToFileURL(`${publicDir}/shortlist.js`).href);
}
const memoryStorage = () => {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
};

test('UI serves actual public files with content types and missing files return 404', async () => {
  const app = createApp({ dataset, publicDir });
  for (const [route, file, mime] of [ ['/', 'index.html', 'text/html'],
    ['/styles.css', 'styles.css', 'text/css'], ['/app.js', 'app.js', 'javascript'],
    ['/shortlist.js', 'shortlist.js', 'javascript'] ]) {
    const response = await app.request(route);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(mime);
    expect(await response.text()).toBe(await readFile(`${publicDir}/${file}`, 'utf8'));
  }
  expect((await app.request('/missing-file.css')).status).toBe(404);
});

test('shortlist persists only IDs, reloads, isolates runs and supports removal', async () => {
  const { createShortlist } = await shortlistModule();
  const storage = memoryStorage();
  const [first, second] = dataset.events.map((event) => event.id);
  const shortlist = createShortlist(storage, dataset.runId);
  expect(shortlist.list()).toEqual([]);
  expect(shortlist.toggle(first)).toBe(true);
  expect(shortlist.toggle(second)).toBe(true);
  expect(shortlist.has(first)).toBe(true);
  expect(JSON.parse(storage.data.get(`radar:${dataset.runId}:shortlist`)!)).toEqual([first, second]);
  const copy = shortlist.list(); copy.length = 0;
  expect(shortlist.list()).toEqual([first, second]);
  const reloaded = createShortlist(storage, dataset.runId);
  expect(reloaded.list()).toEqual([first, second]);
  expect(createShortlist(storage, `${dataset.runId}-other`).list()).toEqual([]);
  expect(reloaded.toggle(first)).toBe(false);
  expect(createShortlist(storage, dataset.runId).list()).toEqual([second]);
});

test('shortlist recovers from corrupt or non-array saved data', async () => {
  const { createShortlist } = await shortlistModule();
  for (const value of ['{broken', '{}', 'null']) {
    const storage = memoryStorage();
    storage.setItem(`radar:${dataset.runId}:shortlist`, value);
    const shortlist = createShortlist(storage, dataset.runId);
    expect(shortlist.list()).toEqual([]);
    expect(shortlist.toggle(dataset.events[0].id)).toBe(true);
    expect(createShortlist(storage, dataset.runId).list()).toEqual([dataset.events[0].id]);
  }
});
