// Loads Man Utd Premier League fixtures from the free openfootball dataset
// (https://github.com/openfootball/football.json). No API key needed.
// Kick-off times are UK local time.

import { cleanTeamName, groundFor } from './grounds.js';

const TEAM = 'Manchester United';
const CACHE_MS = 6 * 60 * 60 * 1000;
let cache = { at: 0, data: null };

// Season "2026-27" runs Aug 2026 → May 2027.
export function seasonsAround(date = new Date()) {
  const y = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 6 ? y : y - 1; // July onwards = new season
  const fmt = (s) => `${s}-${String((s + 1) % 100).padStart(2, '0')}`;
  return [fmt(start), fmt(start + 1)];
}

function seasonUrl(season) {
  return `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/en.1.json`;
}

export function toFixtures(json, season) {
  return (json.matches || [])
    .filter((m) => cleanTeamName(m.team1) === TEAM || cleanTeamName(m.team2) === TEAM)
    .map((m) => {
      const home = cleanTeamName(m.team1);
      const away = cleanTeamName(m.team2);
      const isHome = home === TEAM;
      const opponent = isHome ? away : home;
      const ground = groundFor(m.team1) || { stadium: 'Unknown', city: '', airports: ['MAN'] };
      const ft = m.score?.ft;
      return {
        id: `${m.date}-${home}-${away}`.replace(/[^a-z0-9-]/gi, '').toLowerCase(),
        season,
        competition: 'Premier League',
        round: m.round,
        date: m.date,
        time: m.time || null,
        home,
        away,
        isHome,
        opponent,
        venue: ground.stadium,
        city: ground.city,
        airports: ground.airports,
        result: ft ? `${ft[0]}-${ft[1]}` : null,
      };
    });
}

export async function getFixtures({ fetchImpl = fetch, now = new Date() } = {}) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const all = [];
  for (const season of seasonsAround(now)) {
    try {
      const res = await fetchImpl(seasonUrl(season));
      if (!res.ok) continue; // next season usually isn't published until June
      all.push(...toFixtures(await res.json(), season));
    } catch (err) {
      console.warn(`Could not load fixtures for ${season}: ${err.message}`);
    }
  }
  all.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  if (all.length) cache = { at: Date.now(), data: all };
  return all;
}
