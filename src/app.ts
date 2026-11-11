import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { AppOptions, Dataset, FilterEvents } from './types.js';

export function createApp({ dataset, publicDir }: AppOptions = {}): Hono {
  const app = new Hono();
  let api: Promise<Hono> | undefined;
  let ui: Promise<Hono> | undefined;
  const filter: FilterEvents = async (events, filters) => {
    const { filterEvents } = await import('./filter/index.js');
    return filterEvents(events, filters);
  };
  app.all('*', async (c) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
      api ??= import('./api/index.js').then(({ createApi }) => createApi(
        dataset ?? JSON.parse(readFileSync(new URL('../data/research.json', import.meta.url), 'utf8')) as Dataset,
        filter,
      ));
      return (await api).fetch(c.req.raw);
    }
    ui ??= import('./ui/index.js').then(({ createUi }) => createUi(
      publicDir ?? fileURLToPath(new URL('../public', import.meta.url)),
    ));
    return (await ui).fetch(c.req.raw);
  });
  return app;
}
