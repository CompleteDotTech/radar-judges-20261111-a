import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { createUi } from '../../src/ui/index.js';

test('static UI contains paths including symlinks within its public directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'radar-ui-'));
  try {
    const publicDir = join(root, 'public');
    await mkdir(publicDir);
    await writeFile(join(publicDir, 'index.html'), '<h1>Radar</h1>');
    await writeFile(join(root, 'private.txt'), 'private');
    await symlink(join(root, 'private.txt'), join(publicDir, 'escape.txt'));
    const app = createUi(publicDir);
    expect((await app.request('/')).status).toBe(200);
    for (const path of ['/escape.txt', '/%2e%2e%2fprivate.txt', '/%00', '/missing.js']) {
      expect((await app.request(path)).status).toBe(404);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('shortlist stays usable with blocked storage and returns defensive copies', async () => {
  const { createShortlist } = await import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), 'public/shortlist.js')).href);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const shortlist = createShortlist(blocked, 'run');
  expect(shortlist.toggle('event-one')).toBe(true);
  expect(shortlist.has('event-one')).toBe(true);
  shortlist.values().push('event-two');
  expect(shortlist.list()).toEqual(['event-one']);
  expect(shortlist.toggle('event-one')).toBe(false);
});

test('shortlist discards invalid stored members and deduplicates IDs', async () => {
  const { createShortlist } = await import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), 'public/shortlist.js')).href);
  const storage = { getItem: () => '["one","one",null,{},5,""]', setItem() {} };
  expect(createShortlist(storage, 'run').list()).toEqual(['one']);
});
