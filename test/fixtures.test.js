import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFixtures, seasonsAround } from '../lib/fixtures.js';

test('seasonsAround picks current and next season', () => {
  assert.deepEqual(seasonsAround(new Date('2026-10-07')), ['2026-27', '2027-28']);
  assert.deepEqual(seasonsAround(new Date('2027-03-01')), ['2026-27', '2027-28']);
});

test('toFixtures keeps Man Utd games with venue airports', () => {
  const json = { matches: [
    { round: 'Matchday 8', date: '2026-10-10', time: '17:30', team1: 'Manchester United FC', team2: 'Tottenham Hotspur FC' },
    { round: 'Matchday 9', date: '2026-10-18', time: '14:00', team1: 'Leeds United FC', team2: 'Manchester United FC' },
    { round: 'Matchday 9', date: '2026-10-18', time: '16:30', team1: 'Arsenal FC', team2: 'Chelsea FC' },
  ] };
  const f = toFixtures(json, '2026-27');
  assert.equal(f.length, 2);
  assert.equal(f[0].isHome, true);
  assert.equal(f[0].opponent, 'Tottenham Hotspur');
  assert.deepEqual(f[0].airports, ['MAN', 'LPL', 'LBA']);
  assert.equal(f[1].isHome, false);
  assert.equal(f[1].venue, 'Elland Road');
  assert.deepEqual(f[1].airports, ['LBA', 'MAN']);
});
