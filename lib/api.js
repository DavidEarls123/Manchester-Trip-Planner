// The app's API, shared by the Vercel functions in /api and the local dev server.
// Each handler returns { status, body }.

import { timingSafeEqual } from 'node:crypto';
import { getFixtures } from './fixtures.js';
import { createFlightSearch, combineTrips, toMinutes } from './flights.js';

const MAX_DATES_PER_LEG = 4;

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
  const found = [];
  const links = [];
  const errors = [];
  await Promise.all(
    leg.dates.map(async (date) => {
      try {
        const r = await flightSearch().searchLeg({ ...leg, date });
        found.push(...r.flights);
        if (r.link) links.push({ date, url: r.link });
      } catch (err) {
        errors.push(`${date}: ${err.message}`);
      }
    }),
  );
  found.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.stops - b.stops);
  links.sort((a, b) => a.date.localeCompare(b.date));
  return { flights: found, links, errors };
}

export async function config() {
  return { status: 200, body: { mode: flightSearch().mode, pinRequired: pinRequired() } };
}

export async function fixtures() {
  return { status: 200, body: await getFixtures() };
}

export async function search(body = {}, pin) {
  if (!pinOk(pin)) return { status: 401, body: { error: 'Wrong or missing PIN', pin: true } };

  const currency = /^[A-Z]{3}$/.test(body.currency || '') ? body.currency : 'GBP';
  const shared = { directOnly: body.directOnly, currency };
  const out = parseLeg(body.outbound, shared);
  const ret = body.inbound ? parseLeg(body.inbound, shared) : null;

  for (const [name, leg] of [['Outbound', out], ['Return', ret]]) {
    if (!leg) continue;
    if (!leg.from.length || !leg.to.length) return { status: 400, body: { error: `${name}: choose at least one airport each end` } };
    if (!leg.dates.length) return { status: 400, body: { error: `${name}: choose at least one date` } };
  }

  const [outbound, inbound] = await Promise.all([searchLegAllDates(out), ret ? searchLegAllDates(ret) : null]);
  return {
    status: 200,
    body: {
      mode: flightSearch().mode,
      currency,
      outbound,
      inbound,
      trips: inbound ? combineTrips(outbound.flights, inbound.flights, 10) : [],
    },
  };
}
