// Zero-dependency static file server for local dev and Playwright e2e runs.
// The app is plain ES modules with no bundler, so it needs to be served over
// http:// (module scripts are blocked under file://) — this is that server.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = normalize(join(ROOT, requestPath));

    // Prevent escaping the project root via ../ in the request path.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let stats = await stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      stats = await stat(filePath).catch(() => null);
    }
    if (!stats) {
      res.writeHead(404).end('Not found');
      return;
    }

    const body = await readFile(filePath);
    const type = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`Fit Fly dev server: http://127.0.0.1:${PORT}`);
});
