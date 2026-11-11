import type { Hono } from 'hono';

/** UI sibling owns implementation and public assets; see docs/api.md. */
export function createUi(_publicDir: string): Hono {
  throw new Error('createUi is not implemented');
}
