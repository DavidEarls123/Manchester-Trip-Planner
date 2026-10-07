// Optional: run the app on your own computer (`npm start`) instead of Vercel.
// Serves ./public and the same API as the Vercel functions in ./api.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile?.();
} catch {
  // no .env file — fine, demo mode
}

const api = await import('./lib/api.js');
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 100_000) throw new Error('Request too large');
  }
  return JSON.parse(data || '{}');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    let result;
    if (url.pathname === '/api/config') result = await api.config();
    else if (url.pathname === '/api/fixtures') result = await api.fixtures();
    else if (url.pathname === '/api/search' && req.method === 'POST') {
      result = await api.search(await readBody(req), req.headers['x-app-pin']);
    }
    if (result) return send(res, result.status, result.body);

    const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = join(PUBLIC_DIR, path);
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
    const content = await readFile(file).catch(() => null);
    if (!content) return send(res, 404, 'Not found', 'text/plain');
    return send(res, 200, content, TYPES[extname(file)] || 'application/octet-stream');
  } catch (err) {
    return send(res, 400, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  const { body } = await api.config();
  console.log(`Man Utd Trip Planner running at http://localhost:${PORT}`);
  console.log(body.mode === 'live'
    ? 'Flight prices: LIVE (SerpApi / Google Flights)'
    : 'Flight prices: DEMO data — add SERPAPI_KEY to .env for real prices');
});
