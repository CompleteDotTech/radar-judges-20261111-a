import { Hono } from 'hono';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';

export function createUi(publicDir: string): Hono {
  const app = new Hono();
  const inside = (root: string, file: string) => {
    const path = relative(root, file);
    return path !== '..' && !path.startsWith('../') && !isAbsolute(path);
  };
  app.get('*', async (c) => {
    try {
      const root = await realpath(resolve(publicDir));
      const path = decodeURIComponent(new URL(c.req.url).pathname);
      if (path.includes('\0') || path.includes('\\')) return c.notFound();
      const file = resolve(root, path === '/' ? 'index.html' : `.${path}`);
      if (!inside(root, file)) return c.notFound();
      const canonical = await realpath(file);
      if (!inside(root, canonical) || !(await stat(canonical)).isFile()) return c.notFound();
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      c.header('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      c.header('X-Content-Type-Options', 'nosniff');
      c.header('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      return c.body(await readFile(canonical));
    } catch { return c.notFound(); }
  });
  return app;
}
