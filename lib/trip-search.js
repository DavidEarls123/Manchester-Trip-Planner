// Runs a full trip search (both directions, every selected day) on top of a
// flight provider from flights.js. No Node-only code, so the demo page can use it too.

import { airportRank, combineTrips, compareBy, toMinutes } from './flights.js';

const MAX_DATES_PER_LEG = 4;

// Keeps the order given: the first airport is the most preferred.
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

async function searchLegAllDates(flightSearch, leg) {
  const found = [];
  const links = [];
  const errors = [];
  await Promise.all(
    leg.dates.map(async (date) => {
      try {
        const r = await flightSearch.searchLeg({ ...leg, date });
        found.push(...r.flights.map((f) => ({ ...f, rank: airportRank(f, leg.from, leg.to) })));
        if (r.link) links.push({ date, url: r.link });
      } catch (err) {
        errors.push(`${date}: ${err.message}`);
      }
    }),
  );
  found.sort(compareBy('price'));
  links.sort((a, b) => a.date.localeCompare(b.date));
  return { flights: found, links, errors };
}

// Returns { status, body } like the API handlers.
export async function runSearch(body = {}, flightSearch) {
  const currency = /^[A-Z]{3}$/.test(body.currency || '') ? body.currency : 'GBP';
  const shared = { directOnly: body.directOnly, currency };
  const out = parseLeg(body.outbound, shared);
  const ret = body.inbound ? parseLeg(body.inbound, shared) : null;

  for (const [name, leg] of [['Outbound', out], ['Return', ret]]) {
    if (!leg) continue;
    if (!leg.from.length || !leg.to.length) return { status: 400, body: { error: `${name}: choose at least one airport each end` } };
    if (!leg.dates.length) return { status: 400, body: { error: `${name}: choose at least one date` } };
  }

  const [outbound, inbound] = await Promise.all([
    searchLegAllDates(flightSearch, out),
    ret ? searchLegAllDates(flightSearch, ret) : null,
  ]);
  return {
    status: 200,
    body: {
      mode: flightSearch.mode,
      currency,
      outbound,
      inbound,
      trips: {
        airports: inbound ? combineTrips(outbound.flights, inbound.flights, 10, 'airports') : [],
        price: inbound ? combineTrips(outbound.flights, inbound.flights, 10, 'price') : [],
      },
    },
  };
}
