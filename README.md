# Man Utd Trip Planner

A small personal web app for planning flights to Manchester United games.

1. **Pick a fixture.** Every upcoming Man Utd Premier League game is listed, with home/away filters. You can also plan a custom trip for cup or European games.
2. **Pick your days.** Tick one or more days to fly out (up to 3 days before) and back (up to 3 days after).
3. **Get the best flights.** You see the cheapest outbound + return combinations, plus every option for each direction, with prices.

![screenshot](docs/screenshot.png)

## Features

- **Your airports, saved.** Set your home airport(s) and preferred airport(s) for Old Trafford once (⚙ My airports). They're pre-filled on every search, and you can override them per trip.
- **Same airport or not.** By default the return flies from the airport you flew into, back to the airport you left from. Untick either box to fly home from somewhere else (for example, into MAN and out of LPL) or to land at a different home airport.
- **Away games.** Each away ground suggests its nearest airports (Newcastle → NCL, Chelsea → LHR/LGW/LCY, …). Click the chips to add or remove them.
- **Time windows.** Each direction has depart after/before and arrive after/by.
  - *Land in time for kick-off* fills in a matchday flight that lands a set number of hours before kick-off.
  - *Leave after full time* fills in a matchday return that departs a set number of hours after kick-off.

  You can change both gaps in settings.
- **Direct only** filter and GBP/EUR/USD prices.
- A **View** link on every flight opens Google Flights so you can book.

## Running it

Needs Node.js 18+ and no `npm install`; the app has no dependencies.

```bash
cp .env.example .env     # then add your SerpApi key (see below)
npm start                # → http://localhost:3000
```

### Real prices: SerpApi key

Live prices come from Google Flights through [SerpApi](https://serpapi.com/google-flights-api).
Sign up for the free plan, copy your API key into `.env` as `SERPAPI_KEY=...`, and restart.

Without a key the app runs in **demo mode** with made-up prices (shown by the "Demo prices" badge), so you can try it out.

Each day you select uses one search per direction. Results are cached for 3 hours (`FLIGHT_CACHE_MINUTES`), so going back and forth costs nothing.

### Fixtures

Fixtures come from the free [openfootball](https://github.com/openfootball/football.json) dataset, with no key needed.
Kick-off times are UK time and can move for TV, so double-check before booking.
Only Premier League games are included. Use **custom trip** for cup and European games.

## Notes

- Each direction is priced as a one-way fare. That's what makes mixing airports work, and it's how Ryanair/easyJet/Aer Lingus price these routes anyway.
- A trip is only shown if the return leaves at least 2 hours after the outbound lands.
- To change a ground's airports, edit `lib/grounds.js`.

## Development

```bash
npm test
```
