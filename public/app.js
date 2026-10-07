const $ = (id) => document.getElementById(id);
const PREFS_KEY = 'mutp-prefs';
const DEFAULT_PREFS = { home: '', man: 'MAN', currency: 'GBP', direct: false, before: 3, after: 3 };

const state = {
  fixtures: [],
  filter: 'all',
  fixture: null, // selected fixture (or custom trip object)
  custom: false,
};

// ---------- prefs ----------

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode etc. */
  }
}
let prefs = loadPrefs();

function fillSettings() {
  $('pref-home').value = prefs.home;
  $('pref-man').value = prefs.man;
  $('pref-currency').value = prefs.currency;
  $('pref-direct').checked = prefs.direct;
  $('pref-before').value = prefs.before;
  $('pref-after').value = prefs.after;
}

$('settings-btn').onclick = () => {
  fillSettings();
  $('settings').classList.toggle('hidden');
};
$('settings-save').onclick = () => {
  prefs = {
    home: codes($('pref-home').value).join(','),
    man: codes($('pref-man').value).join(',') || 'MAN',
    currency: $('pref-currency').value,
    direct: $('pref-direct').checked,
    before: Number($('pref-before').value) || 0,
    after: Number($('pref-after').value) || 3,
  };
  savePrefs(prefs);
  $('settings').classList.add('hidden');
  if (state.fixture) openTrip(state.fixture);
};

// ---------- helpers ----------

const codes = (s) => [...new Set(String(s || '').toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{3}$/.test(c)))];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function niceDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}
function hm(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function toMin(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function dur(mins) {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
function money(n, cur) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
}
const today = () => new Date().toISOString().slice(0, 10);

// ---------- fixtures ----------

async function loadFixtures() {
  try {
    const [cfg, fx] = await Promise.all([fetch('/api/config').then((r) => r.json()), fetch('/api/fixtures').then((r) => r.json())]);
    const badge = $('mode-badge');
    badge.textContent = cfg.mode === 'live' ? 'Live prices' : 'Demo prices';
    badge.className = `badge ${cfg.mode}`;
    badge.title = cfg.mode === 'live' ? 'Prices from Google Flights via SerpApi' : 'No SERPAPI_KEY set: prices are made up';
    state.fixtures = Array.isArray(fx) ? fx : [];
  } catch (e) {
    state.fixtures = [];
  }
  renderFixtures();
  if (!prefs.home) {
    fillSettings();
    $('settings').classList.remove('hidden');
  }
}

function renderFixtures() {
  const list = state.fixtures
    .filter((f) => f.date >= today())
    .filter((f) => state.filter === 'all' || (state.filter === 'home' ? f.isHome : !f.isHome));
  const box = $('fixtures');
  if (!list.length) {
    box.innerHTML = '<p class="muted">No upcoming fixtures found. Use a custom trip below.</p>';
    return;
  }
  box.innerHTML = list
    .map(
      (f) => `
      <button type="button" class="fixture ${f.isHome ? 'home' : 'away'} ${state.fixture?.id === f.id ? 'selected' : ''}" data-id="${esc(f.id)}">
        <span class="fx-date">${esc(niceDate(f.date, { weekday: 'short', day: 'numeric', month: 'short' }))}<br><b>${esc(f.time || 'TBC')}</b></span>
        <span class="fx-main">
          <span class="fx-ha">${f.isHome ? 'H' : 'A'}</span>
          <span><b>${f.isHome ? 'v' : '@'} ${esc(f.opponent)}</b><br><span class="muted small">${esc(f.venue)}${f.city ? ', ' + esc(f.city) : ''}</span></span>
        </span>
      </button>`,
    )
    .join('');
}

$('fixtures').onclick = (e) => {
  const btn = e.target.closest('.fixture');
  if (!btn) return;
  const f = state.fixtures.find((x) => x.id === btn.dataset.id);
  state.custom = false;
  openTrip(f);
};
$('fixture-filter').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.filter = b.dataset.f;
  [...$('fixture-filter').children].forEach((x) => x.classList.toggle('on', x === b));
  renderFixtures();
};
$('custom-trip').onclick = () => {
  state.custom = true;
  const date = addDays(today(), 7);
  $('custom-name').value = '';
  $('custom-date').value = date;
  $('custom-time').value = '';
  $('custom-airports').value = prefs.man;
  openTrip(customFixture());
};

function customFixture() {
  const date = $('custom-date').value || addDays(today(), 7);
  const airports = codes($('custom-airports').value);
  return {
    id: 'custom',
    custom: true,
    date,
    time: $('custom-time').value || null,
    opponent: $('custom-name').value || 'Custom trip',
    isHome: false,
    venue: '',
    city: '',
    airports: airports.length ? airports : codes(prefs.man),
  };
}
['custom-name', 'custom-date', 'custom-time', 'custom-airports'].forEach((id) =>
  $(id).addEventListener('change', () => {
    state.fixture = customFixture();
    renderDates(true);
    renderSummary();
    $('out-to').value = state.fixture.airports.join(',');
    syncReturn();
  }),
);

// ---------- trip form ----------

function arrivalAirports(f) {
  if (f.isHome) return codes(prefs.man).length ? codes(prefs.man) : f.airports;
  return f.airports.slice(0, 1);
}

function openTrip(f) {
  state.fixture = f;
  renderFixtures();
  $('custom-fields').classList.toggle('hidden', !state.custom);
  $('trip').classList.remove('hidden');
  $('results').classList.add('hidden');

  $('out-from').value = prefs.home;
  $('out-to').value = arrivalAirports(f).join(',');
  $('direct').checked = prefs.direct;
  $('currency').value = prefs.currency;
  $('ret-on').checked = true;
  $('ret-from-same').checked = true;
  $('ret-to-same').checked = true;
  clearTimes('out');
  clearTimes('ret');

  renderSummary();
  renderDates(true);
  syncReturn();
  $('trip').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummary() {
  const f = state.fixture;
  const ko = f.time ? `Kick-off ${f.time} UK` : 'Kick-off TBC';
  $('trip-summary').innerHTML = `
    <b>${f.custom ? esc(f.opponent) : `${esc(f.home)} v ${esc(f.away)}`}</b>
    <span>${esc(niceDate(f.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}, ${esc(ko)}</span>
    ${f.venue ? `<span class="muted">${esc(f.venue)}${f.city ? ', ' + esc(f.city) : ''}, nearby airports: ${esc(f.airports.join(', '))}</span>` : ''}`;

  const sug = f.isHome ? [...new Set([...codes(prefs.man), ...f.airports])] : f.airports;
  $('out-to-suggest').innerHTML = sug.map((a) => `<button type="button" class="chip" data-code="${a}">${a}</button>`).join('');
}

$('out-to-suggest').onclick = (e) => {
  const b = e.target.closest('[data-code]');
  if (!b) return;
  const cur = codes($('out-to').value);
  const code = b.dataset.code;
  $('out-to').value = (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]).join(',');
  syncReturn();
};

function dateChips(container, offsets, selected) {
  const f = state.fixture;
  container.innerHTML = offsets
    .map((o) => {
      const d = addDays(f.date, o);
      const tag = o === 0 ? 'Matchday' : o < 0 ? `${-o} day${o < -1 ? 's' : ''} before` : `${o} day${o > 1 ? 's' : ''} after`;
      const past = d < today();
      return `<button type="button" class="chip date ${selected.includes(o) && !past ? 'on' : ''}" data-date="${d}" ${past ? 'disabled' : ''}>
        <b>${esc(niceDate(d))}</b><small>${tag}</small></button>`;
    })
    .join('');
}

function renderDates(reset) {
  const keep = (id) => [...$(id).querySelectorAll('.on')].map((b) => b.dataset.date);
  const prevOut = reset ? null : keep('out-dates');
  const prevRet = reset ? null : keep('ret-dates');
  dateChips($('out-dates'), [-3, -2, -1, 0], [-1]);
  dateChips($('ret-dates'), [0, 1, 2, 3], [1]);
  if (prevOut?.length) restoreChips('out-dates', prevOut);
  if (prevRet?.length) restoreChips('ret-dates', prevRet);
  updateCost();
}
function restoreChips(id, dates) {
  $(id).querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', dates.includes(b.dataset.date)));
}

for (const id of ['out-dates', 'ret-dates']) {
  $(id).onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b || b.disabled) return;
    const selected = $(id).querySelectorAll('.on').length;
    if (!b.classList.contains('on') && selected >= 4) return; // keep API usage sane
    b.classList.toggle('on');
    updateCost();
  };
}

const selectedDates = (id) => [...$(id).querySelectorAll('.chip.on')].map((b) => b.dataset.date);

function syncReturn() {
  const fromSame = $('ret-from-same').checked;
  const toSame = $('ret-to-same').checked;
  if (fromSame) $('ret-from').value = $('out-to').value;
  if (toSame) $('ret-to').value = $('out-from').value;
  $('ret-from').disabled = fromSame;
  $('ret-to').disabled = toSame;
}
['out-from', 'out-to'].forEach((id) => $(id).addEventListener('input', syncReturn));
['ret-from-same', 'ret-to-same'].forEach((id) => $(id).addEventListener('change', syncReturn));

$('ret-on').onchange = () => {
  $('ret-body').classList.toggle('disabled', !$('ret-on').checked);
  updateCost();
};

function clearTimes(leg) {
  for (const k of ['depart-after', 'depart-before', 'arrive-after', 'arrive-by']) $(`${leg}-${k}`).value = '';
}
document.querySelectorAll('[data-clear]').forEach((b) => (b.onclick = () => clearTimes(b.dataset.clear)));

// "Land in time for kick-off": fly on matchday, land at least N hours before KO.
$('out-ko').onclick = () => {
  const ko = toMin(state.fixture.time);
  if (ko == null) return alert('Kick-off time is not confirmed yet.');
  restoreChips('out-dates', [state.fixture.date]);
  $('out-arrive-by').value = hm(Math.max(0, ko - prefs.before * 60));
  updateCost();
};
// "Leave after full time": fly home on matchday, departing N hours after KO.
$('ret-ft').onclick = () => {
  const ko = toMin(state.fixture.time);
  if (ko == null) return alert('Kick-off time is not confirmed yet.');
  const after = ko + prefs.after * 60;
  if (after >= 1440) return alert('That would be after midnight. Pick the day after instead.');
  restoreChips('ret-dates', [state.fixture.date]);
  $('ret-depart-after').value = hm(after);
  updateCost();
};

function updateCost() {
  const n = selectedDates('out-dates').length + ($('ret-on').checked ? selectedDates('ret-dates').length : 0);
  $('search-cost').textContent = `${n} search${n === 1 ? '' : 'es'} (one per day per direction). Repeat searches are cached.`;
}

// ---------- search ----------

function legPayload(leg) {
  const v = (k) => $(`${leg}-${k}`).value || undefined;
  return {
    from: codes($(`${leg}-from`).value),
    to: codes($(`${leg}-to`).value),
    dates: selectedDates(`${leg}-dates`),
    departAfter: v('depart-after'),
    departBefore: v('depart-before'),
    arriveAfter: v('arrive-after'),
    arriveBefore: v('arrive-by'),
  };
}

$('trip').onsubmit = async (e) => {
  e.preventDefault();
  syncReturn();
  const body = {
    outbound: legPayload('out'),
    inbound: $('ret-on').checked ? legPayload('ret') : null,
    directOnly: $('direct').checked,
    currency: $('currency').value,
  };
  if (!body.outbound.from.length) {
    alert('Set your home airport first (⚙ My airports), or type one in "From".');
    return;
  }
  const btn = $('search-btn');
  btn.disabled = true;
  btn.textContent = 'Searching…';
  const out = $('results');
  out.classList.remove('hidden');
  out.innerHTML = '<div class="card"><p class="muted">Searching flights…</p></div>';
  try {
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    renderResults(data, body);
  } catch (err) {
    out.innerHTML = `<div class="card error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Find flights';
  }
};

// ---------- results ----------

function googleLink(f) {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`one way flights from ${f.from} to ${f.to} on ${f.date}`)}&curr=${state.currency}`;
}

function flightRow(f, cur) {
  const nextDay = f.arriveMinutes >= 1440 ? '<sup>+1</sup>' : '';
  return `
    <div class="flight">
      <div class="f-when">
        <div class="f-date">${esc(niceDate(f.date))}</div>
        <div class="f-times"><b>${esc(f.departTime)}</b> → <b>${esc(f.arriveTime)}</b>${nextDay}</div>
        <div class="muted small">${esc(f.from)} → ${esc(f.to)} · ${dur(f.durationMinutes)} · ${f.stops ? `${f.stops} stop${f.stops > 1 ? 's' : ''}` : 'Direct'}</div>
      </div>
      <div class="f-airline">
        ${f.airlineLogo ? `<img src="${esc(f.airlineLogo)}" alt="" width="22" height="22" />` : ''}
        <span>${esc(f.airlines.join(' + '))}<br><span class="muted small">${esc(f.flightNumbers.join(', '))}</span></span>
      </div>
      <div class="f-price">${f.price != null ? money(f.price, cur) : '<span class="muted">n/a</span>'}
        <a class="small" href="${googleLink(f)}" target="_blank" rel="noopener">View</a></div>
    </div>`;
}

function legSection(title, leg, cur, limit = 12) {
  if (!leg) return '';
  const errs = leg.errors.length ? `<p class="error small">${leg.errors.map(esc).join('<br>')}</p>` : '';
  const links = leg.links.length
    ? `<p class="small">Open in Google Flights: ${leg.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(niceDate(l.date))}</a>`).join(' · ')}</p>`
    : '';
  if (!leg.flights.length) return `<div class="card"><h3>${title}</h3>${errs}<p class="muted">No flights match those days, airports and times. Try widening the time window or adding another airport.</p>${links}</div>`;
  const rows = leg.flights.map((f) => flightRow(f, cur));
  const more = rows.length > limit ? `<details><summary>Show ${rows.length - limit} more</summary>${rows.slice(limit).join('')}</details>` : '';
  return `<div class="card"><h3>${title} <span class="muted small">${leg.flights.length} option${leg.flights.length === 1 ? '' : 's'}, cheapest first</span></h3>${errs}${rows.slice(0, limit).join('')}${more}${links}</div>`;
}

function renderResults(data, req) {
  state.currency = data.currency;
  const cur = data.currency;
  const demo = data.mode === 'demo' ? '<div class="card warn">Demo mode: these prices are made up. Add a free SerpApi key to <code>.env</code> to get real Google Flights prices.</div>' : '';
  let trips = '';
  if (req.inbound) {
    trips = data.trips.length
      ? `<div class="card best"><h3>Best trips <span class="muted small">outbound + return, cheapest total first</span></h3>
          ${data.trips
            .map(
              (t, i) => `
            <div class="trip ${i === 0 ? 'top' : ''}">
              <div class="trip-total">${money(t.total, cur)}${i === 0 ? '<span class="tag">Best</span>' : ''}</div>
              <div class="trip-legs">${flightRow(t.outbound, cur)}${flightRow(t.inbound, cur)}</div>
            </div>`,
            )
            .join('')}</div>`
      : '<div class="card"><h3>Best trips</h3><p class="muted">No outbound and return pair works with these settings.</p></div>';
  }
  $('results').innerHTML = `${demo}${trips}<div class="legs-results">${legSection('Going out', data.outbound, cur)}${legSection('Coming home', data.inbound, cur)}</div>`;
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

loadFixtures();
