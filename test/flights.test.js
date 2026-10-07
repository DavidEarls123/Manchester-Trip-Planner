import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serpApiTimes, withinWindow, combineTrips, createFlightSearch, toMinutes } from '../lib/flights.js';

const flight = (o) => ({
  from: 'DUB', to: 'MAN', date: '2026-10-10', departMinutes: 480, arriveMinutes: 540,
  durationMinutes: 60, stops: 0, price: 50, flightNumbers: ['FR1'], airlines: ['Ryanair'], ...o,
});

test('serpApiTimes builds hour ranges', () => {
  assert.equal(serpApiTimes({}), null);
  assert.equal(serpApiTimes({ departAfter: toMinutes('06:30') }), '6,23');
  assert.equal(serpApiTimes({ arriveBefore: toMinutes('14:30') }), '0,23,0,14');
  assert.equal(serpApiTimes({ arriveBefore: toMinutes('14:00') }), '0,23,0,13');
  assert.equal(serpApiTimes({ departAfter: 600, departBefore: 900 }), '10,14');
});

test('withinWindow applies exact minute limits', () => {
  const f = flight({ departMinutes: 495, arriveMinutes: 560 });
  assert.ok(withinWindow(f, { departAfter: 495 }));
  assert.ok(!withinWindow(f, { departAfter: 496 }));
  assert.ok(!withinWindow(f, { arriveBefore: 559 }));
  assert.ok(!withinWindow(flight({ stops: 1 }), { directOnly: true }));
});

test('combineTrips sorts by total and rejects impossible same-day pairs', () => {
  const out = [flight({ price: 40, departMinutes: 1000, arriveMinutes: 1060, flightNumbers: ['A'] }), flight({ price: 60, flightNumbers: ['B'] })];
  const ret = [flight({ from: 'MAN', to: 'DUB', price: 20, departMinutes: 1100 }), flight({ from: 'MAN', to: 'DUB', date: '2026-10-11', price: 30 })];
  const trips = combineTrips(out, ret);
  // A lands 17:40, same-day return at 18:20 is too tight (< 2h) so A pairs only with next day
  assert.deepEqual(trips.map((t) => [t.outbound.flightNumbers[0], t.total]), [['A', 70], ['B', 80], ['B', 90]]);
});

test('demo search returns stable, filtered, price-sorted results', async () => {
  const s = createFlightSearch({ apiKey: '' });
  assert.equal(s.mode, 'demo');
  const leg = { from: ['DUB'], to: ['MAN'], date: '2026-10-09', departAfter: 600, currency: 'GBP' };
  const a = await s.searchLeg(leg);
  const b = await s.searchLeg(leg);
  assert.deepEqual(a, b);
  assert.ok(a.flights.every((f) => f.departMinutes >= 600));
  for (let i = 1; i < a.flights.length; i++) assert.ok(a.flights[i - 1].price <= a.flights[i].price);
});

test('live search maps SerpApi response', async () => {
  let calledUrl;
  const fetchImpl = async (url) => {
    calledUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        search_metadata: { google_flights_url: 'https://g.co/x' },
        best_flights: [{
          price: 89, total_duration: 65, airline_logo: 'logo.png',
          flights: [{ departure_airport: { id: 'DUB', name: 'Dublin', time: '2026-10-10 07:05' }, arrival_airport: { id: 'MAN', name: 'Manchester', time: '2026-10-10 08:10' }, airline: 'Aer Lingus', flight_number: 'EI 202' }],
        }],
        other_flights: [{
          price: 45, total_duration: 60,
          flights: [{ departure_airport: { id: 'DUB', name: 'Dublin', time: '2026-10-10 13:00' }, arrival_airport: { id: 'MAN', name: 'Manchester', time: '2026-10-10 14:00' }, airline: 'Ryanair', flight_number: 'FR 552' }],
        }],
      }),
    };
  };
  const s = createFlightSearch({ apiKey: 'k', fetchImpl });
  const r = await s.searchLeg({ from: ['DUB', 'ORK'], to: ['MAN'], date: '2026-10-10', arriveBefore: toMinutes('14:30'), directOnly: true, currency: 'EUR' });
  assert.equal(calledUrl.searchParams.get('departure_id'), 'DUB,ORK');
  assert.equal(calledUrl.searchParams.get('outbound_times'), '0,23,0,14');
  assert.equal(calledUrl.searchParams.get('stops'), '1');
  assert.equal(calledUrl.searchParams.get('type'), '2');
  assert.deepEqual(r.flights.map((f) => [f.flightNumbers[0], f.price, f.departTime]), [['FR 552', 45, '13:00'], ['EI 202', 89, '07:05']]);
  assert.equal(r.link, 'https://g.co/x');
});

test('airportRank follows list order, unknown airports last', async () => {
  const { airportRank } = await import('../lib/flights.js');
  const from = ['DUB', 'ORK'];
  const to = ['MAN', 'LPL', 'LBA'];
  assert.equal(airportRank(flight({ from: 'DUB', to: 'MAN' }), from, to), 0);
  assert.equal(airportRank(flight({ from: 'ORK', to: 'MAN' }), from, to), 1);
  assert.equal(airportRank(flight({ from: 'DUB', to: 'LBA' }), from, to), 2);
  assert.equal(airportRank(flight({ from: 'SNN', to: 'LPL' }), from, to), 3);
});

test('combineTrips by airports puts preferred airports first, by price cheapest first', () => {
  const out = [
    flight({ from: 'DUB', to: 'MAN', price: 120, rank: 0, flightNumbers: ['PREF'] }),
    flight({ from: 'DUB', to: 'LPL', price: 30, rank: 1, flightNumbers: ['CHEAP'] }),
  ];
  const ret = [flight({ from: 'MAN', to: 'DUB', date: '2026-10-11', price: 40, rank: 0 })];
  assert.equal(combineTrips(out, ret, 10, 'airports')[0].outbound.flightNumbers[0], 'PREF');
  assert.equal(combineTrips(out, ret, 10, 'price')[0].outbound.flightNumbers[0], 'CHEAP');
});
