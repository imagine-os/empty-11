import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Serves a built `dist/` directory over plain HTTP so Playwright can load real relative asset paths (unlike `file://`, which breaks Vite's absolute-base asset URLs). Returns the base URL and a close function. */
export async function serveDist(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0]!;
    const filePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const resolved = normalize(join(dir, filePath));
    readFile(resolved)
      .then((body) => {
        res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream' });
        res.end(body);
      })
      .catch(() => {
        res.writeHead(404);
        res.end('not found');
      });
  });

  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  };
}
