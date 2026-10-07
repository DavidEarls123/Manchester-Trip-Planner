// Zero-dependency local server: serves the UI in ./public and a small JSON API.
//   GET  /api/config    -> { mode: "live" | "demo" }
//   GET  /api/fixtures  -> Man Utd fixtures
//   POST /api/search    -> outbound + return flight options and best combined trips

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFixtures } from './lib/fixtures.js';
import { createFlightSearch, combineTrips, toMinutes } from './lib/flights.js';

try {
  process.loadEnvFile?.();
} catch {
  // no .env file — fine, demo mode
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const MAX_DATES_PER_LEG = 4;
const flights = createFlightSearch({ cacheMinutes: Number(process.env.FLIGHT_CACHE_MINUTES) || 180 });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const airports = (list) =>
  [...new Set((Array.isArray(list) ? list : String(list || '').split(','))
    .map((a) => String(a).trim().toUpperCase())
    .filter((a) => /^[A-Z]{3}$/.test(a)))];

function parseLeg(leg = {}, shared) {
  const dates = [...new Set(leg.dates || [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, MAX_DATES_PER_LEG);
  return {
    from: airports(leg.from),
    to: airports(leg.to),
    dates,
    departAfter: toMinutes(leg.departAfter),
    departBefore: toMinutes(leg.departBefore),
    arriveAfter: toMinutes(leg.arriveAfter),
    arriveBefore: toMinutes(leg.arriveBefore),
    directOnly: !!shared.directOnly,
    currency: shared.currency,
  };
}

async function searchLegAllDates(leg) {
  const flightsOut = [];
  const links = [];
  const errors = [];
  await Promise.all(
    leg.dates.map(async (date) => {
      try {
        const r = await flights.searchLeg({ ...leg, date });
        flightsOut.push(...r.flights);
        if (r.link) links.push({ date, url: r.link });
      } catch (err) {
        errors.push(`${date}: ${err.message}`);
      }
    }),
  );
  flightsOut.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.stops - b.stops);
  links.sort((a, b) => a.date.localeCompare(b.date));
  return { flights: flightsOut, links, errors };
}

async function handleSearch(body) {
  const currency = /^[A-Z]{3}$/.test(body.currency || '') ? body.currency : 'GBP';
  const shared = { directOnly: body.directOnly, currency };
  const out = parseLeg(body.outbound, shared);
  const ret = body.inbound ? parseLeg(body.inbound, shared) : null;

  for (const [name, leg] of [['Outbound', out], ['Return', ret]]) {
    if (!leg) continue;
    if (!leg.from.length || !leg.to.length) throw new Error(`${name}: choose at least one airport each end`);
    if (!leg.dates.length) throw new Error(`${name}: choose at least one date`);
  }

  const [outbound, inbound] = await Promise.all([searchLegAllDates(out), ret ? searchLegAllDates(ret) : null]);
  return {
    mode: flights.mode,
    currency,
    outbound,
    inbound,
    trips: inbound ? combineTrips(outbound.flights, inbound.flights, 10) : [],
  };
}

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
    if (url.pathname === '/api/config') return send(res, 200, { mode: flights.mode });
    if (url.pathname === '/api/fixtures') return send(res, 200, await getFixtures());
    if (url.pathname === '/api/search' && req.method === 'POST') {
      return send(res, 200, await handleSearch(await readBody(req)));
    }

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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Man Utd Trip Planner running at http://localhost:${PORT}`);
  console.log(flights.mode === 'live'
    ? 'Flight prices: LIVE (SerpApi / Google Flights)'
    : 'Flight prices: DEMO data — add SERPAPI_KEY to .env for real prices');
});
