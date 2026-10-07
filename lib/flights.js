// Flight search. Uses SerpApi's Google Flights engine when SERPAPI_KEY is set,
// otherwise a deterministic demo provider so the app works out of the box.
//
// Every leg is searched as a one-way flight. That makes open-jaw trips
// (fly into MAN, home from LPL) and different home airports trivial, and it
// matches how the low-cost carriers price these routes anyway.

const SERPAPI_URL = 'https://serpapi.com/search.json';

// ---------- time helpers ----------

// "HH:MM" -> minutes since midnight, or null.
export function toMinutes(hhmm) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// "2026-10-10 08:15" -> { date: "2026-10-10", minutes: 495 }
function splitStamp(stamp) {
  const [date, time] = stamp.split(' ');
  return { date, minutes: toMinutes(time) };
}

// Turn exact "depart after / depart by / arrive after / arrive by" windows into
// SerpApi's coarse hour ranges ("dep_from,dep_to[,arr_from,arr_to]").
// End hours are inclusive (18 = up to 18:59), exact filtering happens afterwards.
export function serpApiTimes({ departAfter, departBefore, arriveAfter, arriveBefore }) {
  const h = (v, fallback) => (v == null ? fallback : Math.floor(v / 60));
  const endH = (v) => (v == null ? 23 : Math.max(0, Math.ceil(v / 60) - 1));
  const dep = [h(departAfter, 0), endH(departBefore)];
  const hasArr = arriveAfter != null || arriveBefore != null;
  const arr = [h(arriveAfter, 0), endH(arriveBefore)];
  if (dep[0] === 0 && dep[1] === 23 && !hasArr) return null;
  return hasArr ? [...dep, ...arr].join(',') : dep.join(',');
}

// ---------- normalising ----------

function normaliseSerp(option, searchDate) {
  const segs = option.flights || [];
  if (!segs.length) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = splitStamp(first.departure_airport.time);
  const arr = splitStamp(last.arrival_airport.time);
  return {
    from: first.departure_airport.id,
    fromName: first.departure_airport.name,
    to: last.arrival_airport.id,
    toName: last.arrival_airport.name,
    date: dep.date || searchDate,
    departTime: first.departure_airport.time.split(' ')[1],
    arriveTime: last.arrival_airport.time.split(' ')[1],
    departMinutes: dep.minutes,
    // Arrival on a later day (overnight) counts as later in the day.
    arriveMinutes: arr.minutes + (arr.date && dep.date && arr.date > dep.date ? 1440 : 0),
    durationMinutes: option.total_duration,
    stops: segs.length - 1,
    airlines: [...new Set(segs.map((s) => s.airline))],
    airlineLogo: option.airline_logo || first.airline_logo || null,
    flightNumbers: segs.map((s) => s.flight_number),
    price: typeof option.price === 'number' ? option.price : null,
  };
}

// ---------- providers ----------

async function searchSerpApi({ from, to, date, times, directOnly, currency }, { apiKey, fetchImpl }) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    type: '2', // one-way
    departure_id: from.join(','),
    arrival_id: to.join(','),
    outbound_date: date,
    currency,
    hl: 'en',
    gl: 'uk',
    api_key: apiKey,
  });
  if (times) params.set('outbound_times', times);
  if (directOnly) params.set('stops', '1');

  const res = await fetchImpl(`${SERPAPI_URL}?${params}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    // "no results" is a normal outcome, not a failure
    if (json.error && /hasn't returned any results/i.test(json.error)) return { flights: [], link: null };
    throw new Error(json.error || `SerpApi returned HTTP ${res.status}`);
  }
  const options = [...(json.best_flights || []), ...(json.other_flights || [])];
  return {
    flights: options.map((o) => normaliseSerp(o, date)).filter(Boolean),
    link: json.search_metadata?.google_flights_url || null,
  };
}

// Small seeded PRNG so demo results are stable for the same search.
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const DEMO_AIRLINES = ['Ryanair', 'easyJet', 'Aer Lingus', 'British Airways', 'Jet2', 'Loganair', 'KLM'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

async function searchDemo({ from, to, date }) {
  const flights = [];
  for (const f of from) {
    for (const t of to) {
      if (f === t) continue;
      const rand = seeded(`${f}${t}${date}`);
      const count = 3 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i++) {
        const dep = 360 + Math.floor(rand() * 64) * 15; // 06:00–22:00
        const direct = rand() > 0.25;
        const dur = direct ? 55 + Math.floor(rand() * 60) : 180 + Math.floor(rand() * 180);
        const airline = DEMO_AIRLINES[Math.floor(rand() * DEMO_AIRLINES.length)];
        flights.push({
          from: f, fromName: f, to: t, toName: t, date,
          departTime: fmt(dep), arriveTime: fmt(dep + dur),
          departMinutes: dep, arriveMinutes: dep + dur,
          durationMinutes: dur, stops: direct ? 0 : 1,
          airlines: [airline], airlineLogo: null,
          flightNumbers: [`${airline.slice(0, 2).toUpperCase()}${100 + Math.floor(rand() * 899)}`],
          price: 25 + Math.floor(rand() * 180),
        });
      }
    }
  }
  return { flights, link: null };
}

// ---------- filtering ----------

export function withinWindow(f, { departAfter, departBefore, arriveAfter, arriveBefore, directOnly }) {
  if (directOnly && f.stops > 0) return false;
  if (departAfter != null && f.departMinutes < departAfter) return false;
  if (departBefore != null && f.departMinutes > departBefore) return false;
  if (arriveAfter != null && f.arriveMinutes < arriveAfter) return false;
  if (arriveBefore != null && f.arriveMinutes > arriveBefore) return false;
  return true;
}

export function rankFlights(flights) {
  return [...flights].sort(
    (a, b) =>
      (a.price ?? Infinity) - (b.price ?? Infinity) ||
      a.stops - b.stops ||
      a.durationMinutes - b.durationMinutes,
  );
}

// Airport preference: 0 = your first choice at both ends. Each step down
// either list adds 1. Airports not in the list rank after every listed one.
export function airportRank(f, from = [], to = []) {
  const pos = (list, code) => (list.indexOf(code) < 0 ? list.length : list.indexOf(code));
  return pos(from, f.from) + pos(to, f.to);
}

// Order flights (or trips) either by airport preference then price, or by price alone.
export function compareBy(by) {
  return (a, b) =>
    (by === 'airports' ? (a.rank ?? 0) - (b.rank ?? 0) : 0) ||
    (a.price ?? a.total ?? Infinity) - (b.price ?? b.total ?? Infinity) ||
    (a.stops ?? 0) - (b.stops ?? 0) ||
    (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0);
}

// Best outbound+return pairs. A pair is valid only if the return leaves after
// the outbound lands (matters for same-day trips). `by` is "price" or "airports".
export function combineTrips(outbound, inbound, limit = 10, by = 'price') {
  const trips = [];
  for (const o of outbound) {
    for (const r of inbound) {
      if (o.price == null || r.price == null) continue;
      if (r.date < o.date) continue;
      if (r.date === o.date && r.departMinutes <= o.arriveMinutes + 120) continue;
      trips.push({
        outbound: o,
        inbound: r,
        total: o.price + r.price,
        rank: (o.rank ?? 0) + (r.rank ?? 0),
        stops: o.stops + r.stops,
      });
    }
  }
  trips.sort(compareBy(by));
  // Avoid a top-10 that is the same outbound with ten different returns.
  const seen = new Map();
  return trips
    .filter((t) => {
      const key = `${t.outbound.flightNumbers}|${t.outbound.date}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      return n < 3;
    })
    .slice(0, limit);
}

// ---------- public API ----------

export function createFlightSearch({ apiKey = process.env.SERPAPI_KEY, cacheMinutes = 180, fetchImpl = fetch } = {}) {
  const cache = new Map();
  const mode = apiKey ? 'live' : 'demo';

  async function searchLeg(leg) {
    const times = serpApiTimes(leg);
    const key = JSON.stringify([leg.from, leg.to, leg.date, times, leg.directOnly, leg.currency]);
    const hit = cache.get(key);
    let result;
    if (hit && Date.now() - hit.at < cacheMinutes * 60_000) {
      result = hit.result;
    } else {
      result = apiKey
        ? await searchSerpApi({ ...leg, times }, { apiKey, fetchImpl })
        : await searchDemo(leg);
      cache.set(key, { at: Date.now(), result });
    }
    return {
      ...result,
      flights: rankFlights(result.flights.filter((f) => withinWindow(f, leg))),
    };
  }

  return { mode, searchLeg };
}
