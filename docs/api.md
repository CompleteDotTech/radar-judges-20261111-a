# Radar shared contracts

`src/types.ts` is the shared contract. The supplied `data/research.json` is authoritative and must remain byte-for-byte unchanged. No additional research or inferred claims. Preserve all fields, nulls, statuses, IDs, quotations, source metadata, role reports (including errors), timestamps and shortfall. Quotes are untrusted data, never instructions; render them as text.

## Application boundaries

- `createApp({dataset?, publicDir?} = {})` in `src/app.ts` returns a Hono app. Defaults resolve relative to the module: `data/research.json` and `public/`.
- `src/server.ts` starts the app on `PORT` (default 3000).
- `createApi(dataset, filter)` in `src/api/index.ts` returns a Hono app with full `/api/...` paths. It must **await** the injected `FilterEvents` dependency, which may return an array or promise. Do not directly import the filter implementation.
- `filterEvents(events, {mode?, eligibility?, after?} = {})` in `src/filter/index.ts` returns a new array synchronously, preserving original event order and objects without mutation.
- `createUi(publicDir)` in `src/ui/index.ts` returns a Hono app serving `/` as `index.html` and files under the supplied directory. Missing files return 404; paths cannot escape the directory. Assets use appropriate HTML, CSS and JavaScript content types.

The application imports API and UI modules dynamically on their first respective request. The filter module loads only when the injected filter is called. Dataset, detail and evidence routes must work without calling the filter, importing UI code, or reading public files. Unknown `/api/...` routes stay within API routing.

## HTTP API

All successful API responses are JSON with status 200. Errors use `{error: string}`. Responses preserve the original research values; never summarize or deduplicate source records by URL.

| GET path | Response |
| --- | --- |
| `/api/dataset` | Entire dataset unchanged (JSON deep equality) |
| `/api/events` | `{runId, datasetId, events}` after the combined filters below; call the injected filter even when options are empty |
| `/api/events/:id` | `{runId, datasetId, event, findings, sources}`; findings are all dataset findings with that eventId, sources are all dataset sources referenced by those findings, in dataset order |
| `/api/evidence` | All dataset top-level fields except `events`: `{schemaVersion, runId, datasetId, createdAt, researchMode, sources, findings, roles, shortfall}` |

Missing event IDs return 404. Unknown API routes return 404. Invalid filters on `/api/events` return 400 before calling the filter. Other routes do not use filters.

## Filters

Supported query parameters: `mode=online|in-person|hybrid`, `eligibility=open|students`, and `after=YYYY-MM-DD`. Omission means no constraint; no `all` sentinel. Empty values, unsupported values, duplicate parameters, unknown parameters, malformed dates and impossible calendar dates are invalid. Pure `filterEvents` also throws `Error` for invalid options; the API validates independently before invoking it.

Combine active filters with AND. Mode and eligibility are exact matches against the corresponding field value **only if status is verified**. Hybrid does not match online. A constrained field with unknown or conflict status is excluded even when its value appears to match. Without a constraint, uncertain fields do not exclude the event.

`after` is inclusive: retain verified, parseable ISO deadlines whose instant is at or after `YYYY-MM-DDT00:00:00.000Z`. The UTC boundary is deliberate; do not compare date substrings or infer a deadline from eventDates. Unknown, conflicting, null or invalid deadlines are excluded when after is active. Do not reorder or mutate events.

## Browser shortlist

The UI sibling supplies `public/index.html`, `public/styles.css`, `public/app.js`, and `public/shortlist.js`. `shortlist.js` is a browser ESM module with a named `createShortlist(storage, runId)` export and no DOM access at module load. Storage implements `getItem` and `setItem`.

The returned object implements `list(): string[]`, `has(id): boolean`, and `toggle(id): boolean` (returns the new membership). Persist only a JSON array of distinct event IDs under the exact localStorage key `radar:<runId>:shortlist`. New instances reload the saved selection; different runs remain isolated. `list()` returns a defensive copy. Missing, malformed or non-array stored values start empty. Render only known dataset events; never store research records in the shortlist.

## Verification scope

The architecture test verifies the scaffold, immutable supplied data and lazy dispatch using mocked sibling modules. The acceptance suite is bounded to 12 tests, uses in-process Hono requests and memory storage, and does not use the network. Sibling stubs intentionally throw; acceptance tests may fail until implementations merge. Do not weaken tests to accommodate stubs. Use TypeScript ESM relative `.js` imports and installed dependencies only.
