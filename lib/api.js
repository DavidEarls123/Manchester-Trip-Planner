// The app's API, shared by the Vercel functions in /api and the local dev server.
// Each handler returns { status, body }.

import { timingSafeEqual } from 'node:crypto';
import { getFixtures } from './fixtures.js';
import { createFlightSearch } from './flights.js';
import { runSearch } from './trip-search.js';

let flights;
const flightSearch = () =>
  (flights ??= createFlightSearch({
    apiKey: process.env.SERPAPI_KEY,
    cacheMinutes: Number(process.env.FLIGHT_CACHE_MINUTES) || 180,
  }));

// Optional PIN so a public link can't burn through your SerpApi searches.
const pinRequired = () => !!process.env.APP_PIN;
export function pinOk(given) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function config() {
  return { status: 200, body: { mode: flightSearch().mode, pinRequired: pinRequired() } };
}

export async function fixtures() {
  return { status: 200, body: await getFixtures() };
}

export async function search(body = {}, pin) {
  if (!pinOk(pin)) return { status: 401, body: { error: 'Wrong or missing PIN', pin: true } };
  return runSearch(body, flightSearch());
}
