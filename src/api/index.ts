import { Hono } from 'hono';
import type { Dataset, EventFilters, FilterEvents } from '../types.js';

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseFilters(params: URLSearchParams): EventFilters {
  const filters: EventFilters = {};
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (seen.has(key)) throw new Error(`Duplicate filter: ${key}`);
    seen.add(key);
    switch (key) {
      case 'mode':
        if (value !== 'online' && value !== 'in-person' && value !== 'hybrid' && value !== 'unknown') {
          throw new Error('Invalid mode');
        }
        filters.mode = value;
        break;
      case 'eligibility':
        if (value !== 'open' && value !== 'student-only' && value !== 'students' && value !== 'unknown') throw new Error('Invalid eligibility');
        filters.eligibility = value;
        break;
      case 'after':
        if (!isCalendarDate(value)) throw new Error('Invalid after date; expected YYYY-MM-DD');
        filters.after = value;
        break;
      default:
        throw new Error(`Unknown filter: ${key}`);
    }
  }
  return filters;
}

export function createApi(dataset: Dataset, filterEvents: FilterEvents): Hono {
  const app = new Hono();

  app.get('/api/dataset', (c) => c.json(dataset));

  app.get('/api/events', async (c) => {
    let filters: EventFilters;
    try {
      filters = parseFilters(new URL(c.req.url).searchParams);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Invalid filters' }, 400);
    }
    const events = await filterEvents(dataset.events, filters);
    return c.json({ runId: dataset.runId, datasetId: dataset.datasetId, events });
  });

  app.get('/api/events/:id', (c) => {
    const event = dataset.events.find((event) => event.id === c.req.param('id'));
    if (!event) return c.json({ error: 'Event not found' }, 404);
    const findings = dataset.findings.filter((finding) => finding.eventId === event.id);
    const sourceIds = new Set(findings.map((finding) => finding.sourceId));
    const sources = dataset.sources.filter((source) => sourceIds.has(source.id));
    return c.json({ runId: dataset.runId, datasetId: dataset.datasetId, event, findings, sources });
  });

  app.get('/api/evidence', (c) => {
    const { events: _events, ...evidence } = dataset;
    return c.json(evidence);
  });

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  return app;
}
