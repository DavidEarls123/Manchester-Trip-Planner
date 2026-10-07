// Stadium + nearest useful airports for each club Man Utd might play.
// Airports are listed best-first; the first one is used as the default
// arrival airport for an away fixture. Edit freely.

export const GROUNDS = {
  'Manchester United': { stadium: 'Old Trafford', city: 'Manchester', airports: ['MAN', 'LPL', 'LBA'] },
  'Arsenal': { stadium: 'Emirates Stadium', city: 'London', airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
  'Aston Villa': { stadium: 'Villa Park', city: 'Birmingham', airports: ['BHX', 'EMA'] },
  'AFC Bournemouth': { stadium: 'Vitality Stadium', city: 'Bournemouth', airports: ['BOH', 'SOU', 'LHR'] },
  'Bournemouth': { stadium: 'Vitality Stadium', city: 'Bournemouth', airports: ['BOH', 'SOU', 'LHR'] },
  'Brentford': { stadium: 'Gtech Community Stadium', city: 'London', airports: ['LHR', 'LGW', 'LCY'] },
  'Brighton & Hove Albion': { stadium: 'Amex Stadium', city: 'Brighton', airports: ['LGW', 'LHR'] },
  'Burnley': { stadium: 'Turf Moor', city: 'Burnley', airports: ['MAN', 'LBA', 'LPL'] },
  'Chelsea': { stadium: 'Stamford Bridge', city: 'London', airports: ['LHR', 'LGW', 'LCY'] },
  'Coventry City': { stadium: 'Coventry Building Society Arena', city: 'Coventry', airports: ['BHX', 'EMA'] },
  'Crystal Palace': { stadium: 'Selhurst Park', city: 'London', airports: ['LGW', 'LHR', 'LCY'] },
  'Everton': { stadium: 'Hill Dickinson Stadium', city: 'Liverpool', airports: ['LPL', 'MAN'] },
  'Fulham': { stadium: 'Craven Cottage', city: 'London', airports: ['LHR', 'LGW', 'LCY'] },
  'Hull City': { stadium: 'MKM Stadium', city: 'Hull', airports: ['LBA', 'HUY', 'MAN'] },
  'Ipswich Town': { stadium: 'Portman Road', city: 'Ipswich', airports: ['STN', 'LCY', 'NWI'] },
  'Leeds United': { stadium: 'Elland Road', city: 'Leeds', airports: ['LBA', 'MAN'] },
  'Leicester City': { stadium: 'King Power Stadium', city: 'Leicester', airports: ['EMA', 'BHX'] },
  'Liverpool': { stadium: 'Anfield', city: 'Liverpool', airports: ['LPL', 'MAN'] },
  'Luton Town': { stadium: 'Kenilworth Road', city: 'Luton', airports: ['LTN', 'STN', 'LHR'] },
  'Manchester City': { stadium: 'Etihad Stadium', city: 'Manchester', airports: ['MAN', 'LPL', 'LBA'] },
  'Middlesbrough': { stadium: 'Riverside Stadium', city: 'Middlesbrough', airports: ['NCL', 'MME', 'LBA'] },
  'Newcastle United': { stadium: "St James' Park", city: 'Newcastle', airports: ['NCL'] },
  'Norwich City': { stadium: 'Carrow Road', city: 'Norwich', airports: ['NWI', 'STN'] },
  'Nottingham Forest': { stadium: 'City Ground', city: 'Nottingham', airports: ['EMA', 'BHX'] },
  'Sheffield United': { stadium: 'Bramall Lane', city: 'Sheffield', airports: ['MAN', 'LBA', 'EMA'] },
  'Southampton': { stadium: "St Mary's Stadium", city: 'Southampton', airports: ['SOU', 'LHR', 'LGW'] },
  'Sunderland': { stadium: 'Stadium of Light', city: 'Sunderland', airports: ['NCL', 'MME'] },
  'Tottenham Hotspur': { stadium: 'Tottenham Hotspur Stadium', city: 'London', airports: ['STN', 'LHR', 'LCY', 'LGW'] },
  'West Bromwich Albion': { stadium: 'The Hawthorns', city: 'West Bromwich', airports: ['BHX', 'EMA'] },
  'West Ham United': { stadium: 'London Stadium', city: 'London', airports: ['LCY', 'STN', 'LHR', 'LGW'] },
  'Wolverhampton Wanderers': { stadium: 'Molineux', city: 'Wolverhampton', airports: ['BHX', 'EMA'] },
};

// openfootball names look like "Arsenal FC" / "Hull City AFC"; normalise them.
export function cleanTeamName(name) {
  return name.replace(/\s+(FC|AFC)$/i, '').trim();
}

export function groundFor(team) {
  const name = cleanTeamName(team);
  return GROUNDS[name] || GROUNDS[team] || null;
}
