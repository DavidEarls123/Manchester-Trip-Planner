const $ = (id) => document.getElementById(id);
const PREFS_KEY = 'mutp-prefs';
// from/to are ranked airport lists: index 0 is the favourite.
const DEFAULT_PREFS = { from: [], to: ['MAN', 'LPL'], currency: 'GBP', direct: false, before: 3, after: 3, sort: 'airports' };

const PIN_KEY = 'mutp-pin';
const state = {
  pinRequired: false,
  fixtures: [],
  filter: 'all',
  fixture: null, // selected fixture (or custom trip object)
  custom: false,
  ap: {}, // per-trip airport chips: { 'out-from': [{ code, on }], ... }
  draft: { from: [], to: [] }, // settings lists being edited
  last: null, // last search { data, req } for re-sorting
};

// Names for common airports, shown next to the codes. Unknown codes still work.
const AIRPORT_NAMES = {
  DUB: 'Dublin', ORK: 'Cork', SNN: 'Shannon', NOC: 'Knock', KIR: 'Kerry', BFS: 'Belfast Intl', BHD: 'Belfast City',
  LDY: 'Derry', MAN: 'Manchester', LPL: 'Liverpool', LBA: 'Leeds Bradford', NCL: 'Newcastle', MME: 'Teesside',
  HUY: 'Humberside', EMA: 'East Midlands', BHX: 'Birmingham', LHR: 'Heathrow', LGW: 'Gatwick', STN: 'Stansted',
  LTN: 'Luton', LCY: 'London City', SEN: 'Southend', BRS: 'Bristol', CWL: 'Cardiff', SOU: 'Southampton',
  BOH: 'Bournemouth', NWI: 'Norwich', EXT: 'Exeter', NQY: 'Newquay', EDI: 'Edinburgh', GLA: 'Glasgow',
  PIK: 'Glasgow Prestwick', ABZ: 'Aberdeen', INV: 'Inverness', IOM: 'Isle of Man', JER: 'Jersey', GCI: 'Guernsey',
  AMS: 'Amsterdam', CDG: 'Paris CDG', BRU: 'Brussels', CPH: 'Copenhagen', OSL: 'Oslo', ARN: 'Stockholm',
  KEF: 'Reykjavik', MAD: 'Madrid', BCN: 'Barcelona', AGP: 'Malaga', ALC: 'Alicante', FAO: 'Faro', LIS: 'Lisbon',
  OPO: 'Porto', FCO: 'Rome', MXP: 'Milan', MUC: 'Munich', FRA: 'Frankfurt', BER: 'Berlin', DUS: 'Dusseldorf',
  ZRH: 'Zurich', GVA: 'Geneva', VIE: 'Vienna', WAW: 'Warsaw', KRK: 'Krakow', PRG: 'Prague', BUD: 'Budapest',
  ATH: 'Athens', IST: 'Istanbul', JFK: 'New York JFK', EWR: 'Newark', BOS: 'Boston', ORD: 'Chicago',
};
const apName = (c) => AIRPORT_NAMES[c] || '';

// ---------- prefs ----------

function loadPrefs() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    /* blocked storage: use defaults */
  }
  // Older versions stored comma-separated strings.
  if (saved.home != null && !saved.from) saved.from = codes(saved.home);
  if (saved.man != null && !saved.to) saved.to = codes(saved.man);
  delete saved.home;
  delete saved.man;
  return { ...DEFAULT_PREFS, ...saved };
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
  state.draft = { from: [...prefs.from], to: [...prefs.to] };
  renderPrefList('from');
  renderPrefList('to');
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
  addFromInput('from');
  addFromInput('to');
  if (!state.draft.from.length) {
    $('pref-from-add').focus();
    return;
  }
  prefs = {
    ...prefs,
    from: [...state.draft.from],
    to: state.draft.to.length ? [...state.draft.to] : ['MAN'],
    currency: $('pref-currency').value,
    direct: $('pref-direct').checked,
    before: Number($('pref-before').value) || 0,
    after: Number($('pref-after').value) || 3,
  };
  savePrefs(prefs);
  $('settings').classList.add('hidden');
  if (state.fixture) openTrip(state.fixture);
};

// ---------- ranked airport lists (settings) ----------

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderPrefList(which) {
  const list = state.draft[which];
  const el = $(`pref-${which}-list`);
  if (!list.length) {
    el.innerHTML = `<li class="ap-empty muted">${which === 'from' ? 'Add the airport you usually fly from.' : 'Add an airport.'}</li>`;
    return;
  }
  el.innerHTML = list
    .map(
      (c, i) => `
      <li>
        <span class="ap-rank">${ordinal(i + 1)}</span>
        <span class="ap-name"><b>${esc(c)}</b> <span class="muted">${esc(apName(c))}</span></span>
        <span class="ap-btns">
          <button type="button" class="icon" data-move="-1" data-i="${i}" aria-label="Move ${c} up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon" data-move="1" data-i="${i}" aria-label="Move ${c} down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="icon" data-remove="${i}" aria-label="Remove ${c}">✕</button>
        </span>
      </li>`,
    )
    .join('');
}

for (const which of ['from', 'to']) {
  $(`pref-${which}-list`).onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const list = state.draft[which];
    if (b.dataset.remove != null) list.splice(Number(b.dataset.remove), 1);
    if (b.dataset.move != null) {
      const i = Number(b.dataset.i);
      const j = i + Number(b.dataset.move);
      [list[i], list[j]] = [list[j], list[i]];
    }
    renderPrefList(which);
  };
  $(`pref-${which}-add`).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFromInput(which);
    }
  });
}
document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addFromInput(b.dataset.add.replace('pref-', ''))));

function addFromInput(which) {
  const input = $(`pref-${which}-add`);
  for (const c of codes(input.value)) if (!state.draft[which].includes(c)) state.draft[which].push(c);
  input.value = '';
  renderPrefList(which);
}

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
    state.pinRequired = !!cfg.pinRequired;
    state.fixtures = Array.isArray(fx) ? fx : [];
  } catch (e) {
    state.fixtures = [];
  }
  renderFixtures();
  if (!prefs.from.length) {
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
  $('custom-airports').value = prefs.to.join(', ');
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
    airports: airports.length ? airports : [...prefs.to],
  };
}
['custom-name', 'custom-date', 'custom-time', 'custom-airports'].forEach((id) =>
  $(id).addEventListener('change', () => {
    state.fixture = customFixture();
    renderDates(true);
    renderSummary();
    state.ap['out-to'] = chipList(state.fixture.airports);
    renderAirports();
  }),
);

// ---------- trip form ----------

// Home games use your ranked list; away games the ground's airports, closest first.
function arrivalAirports(f) {
  if (f.isHome && !f.custom) return prefs.to.length ? prefs.to : f.airports;
  return f.airports;
}
const chipList = (list) => list.map((code) => ({ code, on: true }));

function openTrip(f) {
  state.fixture = f;
  renderFixtures();
  $('custom-fields').classList.toggle('hidden', !state.custom);
  $('trip').classList.remove('hidden');
  $('results').classList.add('hidden');

  state.ap = {
    'out-from': chipList(prefs.from),
    'out-to': chipList(arrivalAirports(f)),
    'ret-from': [],
    'ret-to': [],
  };
  $('direct').checked = prefs.direct;
  $('currency').value = prefs.currency;
  $('ret-on').checked = true;
  $('ret-from-same').checked = true;
  $('ret-to-same').checked = true;
  clearTimes('out');
  clearTimes('ret');

  renderSummary();
  renderDates(true);
  renderAirports();
  $('trip').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummary() {
  const f = state.fixture;
  const ko = f.time ? `Kick-off ${f.time} UK` : 'Kick-off TBC';
  $('trip-summary').innerHTML = `
    <b>${f.custom ? esc(f.opponent) : `${esc(f.home)} v ${esc(f.away)}`}</b>
    <span>${esc(niceDate(f.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}, ${esc(ko)}</span>
    ${f.venue ? `<span class="muted">${esc(f.venue)}${f.city ? ', ' + esc(f.city) : ''}, nearby airports: ${esc(f.airports.join(', '))}</span>` : ''}`;
}

// The return mirrors the outbound airports while the "same airports" boxes are ticked.
function apList(id) {
  if (id === 'ret-from' && $('ret-from-same').checked) return state.ap['out-to'];
  if (id === 'ret-to' && $('ret-to-same').checked) return state.ap['out-from'];
  return state.ap[id];
}
const onCodes = (id) => (apList(id) || []).filter((a) => a.on).map((a) => a.code);

function renderAirports() {
  for (const id of ['out-from', 'out-to', 'ret-from', 'ret-to']) {
    const list = apList(id) || [];
    const mirrored = apList(id) !== state.ap[id];
    let n = 0;
    const chips = list
      .map((a) => {
        const rank = a.on ? ++n : null;
        return `<button type="button" class="chip ap ${a.on ? 'on' : 'off'}" data-code="${a.code}" ${mirrored ? 'disabled' : ''}
          aria-pressed="${a.on}" title="${esc(apName(a.code) || a.code)}${a.on ? '' : ' (left out)'}">
          ${rank ? `<span class="ap-num">${rank}</span>` : ''}<b>${a.code}</b>${apName(a.code) ? `<small>${esc(apName(a.code))}</small>` : ''}</button>`;
      })
      .join('');
    const add = mirrored
      ? ''
      : `<input class="ap-plus" data-for="${id}" maxlength="3" placeholder="+ add" aria-label="Add an airport for this trip" />`;
    $(id).innerHTML = chips + add;
  }
}

for (const id of ['out-from', 'out-to', 'ret-from', 'ret-to']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('.chip.ap');
    if (!b || b.disabled) return;
    const a = state.ap[id].find((x) => x.code === b.dataset.code);
    if (a.on && state.ap[id].filter((x) => x.on).length === 1) return notice('Keep at least one airport selected.');
    a.on = !a.on;
    renderAirports();
  });
  const addTyped = (input) => {
    const list = state.ap[id];
    for (const c of codes(input.value)) {
      const hit = list.find((x) => x.code === c);
      hit ? (hit.on = true) : list.push({ code: c, on: true });
    }
    renderAirports();
  };
  $(id).addEventListener('change', (e) => e.target.matches('.ap-plus') && addTyped(e.target));
  $(id).addEventListener('keydown', (e) => {
    if (e.target.matches('.ap-plus') && e.key === 'Enter') {
      e.preventDefault();
      addTyped(e.target);
      $(id).querySelector('.ap-plus')?.focus();
    }
  });
}

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

// Unticking "same airports" starts the return list as a copy you can then change.
for (const [box, id, src] of [['ret-from-same', 'ret-from', 'out-to'], ['ret-to-same', 'ret-to', 'out-from']]) {
  $(box).addEventListener('change', () => {
    if (!$(box).checked) state.ap[id] = state.ap[src].map((a) => ({ ...a }));
    renderAirports();
  });
}

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
  if (ko == null) return notice('Kick-off time is not confirmed yet, so set the times yourself.');
  restoreChips('out-dates', [state.fixture.date]);
  $('out-arrive-by').value = hm(Math.max(0, ko - prefs.before * 60));
  updateCost();
};
// "Leave after full time": fly home on matchday, departing N hours after KO.
$('ret-ft').onclick = () => {
  const ko = toMin(state.fixture.time);
  if (ko == null) return notice('Kick-off time is not confirmed yet, so set the times yourself.');
  const after = ko + prefs.after * 60;
  if (after >= 1440) return notice('That would be after midnight. Pick the day after instead.');
  restoreChips('ret-dates', [state.fixture.date]);
  $('ret-depart-after').value = hm(after);
  updateCost();
};

// Inline message under the search button (alert() is blocked in some views).
let noticeTimer;
function notice(msg) {
  const el = $('notice');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (el.hidden = true), 6000);
}

function updateCost() {
  const n = selectedDates('out-dates').length + ($('ret-on').checked ? selectedDates('ret-dates').length : 0);
  $('search-cost').textContent = `${n} search${n === 1 ? '' : 'es'} (one per day per direction). Numbers show your airport order; tap an airport to leave it out.`;
}

// ---------- search ----------

function storedPin() {
  try {
    return localStorage.getItem(PIN_KEY) || '';
  } catch {
    return state.pin || '';
  }
}
function storePin(pin) {
  state.pin = pin;
  try {
    pin ? localStorage.setItem(PIN_KEY, pin) : localStorage.removeItem(PIN_KEY);
  } catch {
    /* kept in memory for this visit */
  }
}
// Returns the PIN to send, asking once per device. null = user cancelled.
function pinForRequest(force) {
  if (!state.pinRequired) return '';
  let pin = force ? '' : storedPin();
  if (!pin) {
    pin = (prompt(force ? 'Wrong PIN, try again:' : 'Enter your PIN (asked once per device):') || '').trim();
    if (!pin) return null;
    storePin(pin);
  }
  return pin;
}

async function postSearch(body, retry = false) {
  const pin = pinForRequest(retry);
  if (pin == null) throw new Error('A PIN is needed to search flights.');
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Pin': pin },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.status === 401 && data.pin) {
    storePin('');
    if (!retry) return postSearch(body, true);
  }
  if (!res.ok) throw new Error(data.error || 'Search failed');
  return data;
}

function legPayload(leg) {
  const v = (k) => $(`${leg}-${k}`).value || undefined;
  return {
    from: onCodes(`${leg}-from`),
    to: onCodes(`${leg}-to`),
    dates: selectedDates(`${leg}-dates`),
    departAfter: v('depart-after'),
    departBefore: v('depart-before'),
    arriveAfter: v('arrive-after'),
    arriveBefore: v('arrive-by'),
  };
}

$('trip').onsubmit = async (e) => {
  e.preventDefault();
  const body = {
    outbound: legPayload('out'),
    inbound: $('ret-on').checked ? legPayload('ret') : null,
    directOnly: $('direct').checked,
    currency: $('currency').value,
  };
  if (!body.outbound.from.length) {
    notice('Add the airport you fly from: tap ⚙ My airports, or type a code in "+ add" under From.');
    $('out-from').querySelector('.ap-plus')?.focus();
    return;
  }
  const btn = $('search-btn');
  btn.disabled = true;
  btn.textContent = 'Searching…';
  const out = $('results');
  out.classList.remove('hidden');
  out.innerHTML = '<div class="card"><p class="muted">Searching flights…</p></div>';
  try {
    renderResults(await postSearch(body), body);
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// Airport code with its place in your list (only when you searched more than one).
function apTag(code, list) {
  const i = list.indexOf(code);
  if (list.length < 2 || i < 0) return `<b>${esc(code)}</b>`;
  return `<b class="${i === 0 ? 'ap-first' : ''}">${esc(code)}</b><span class="ap-pos" title="Your ${ordinal(i + 1)} choice">${i + 1}</span>`;
}

function flightRow(f, cur, leg) {
  const nextDay = f.arriveMinutes >= 1440 ? '<sup>+1</sup>' : '';
  return `
    <div class="flight">
      <div class="f-when">
        <div class="f-date">${esc(niceDate(f.date))}</div>
        <div class="f-times"><b>${esc(f.departTime)}</b> → <b>${esc(f.arriveTime)}</b>${nextDay}</div>
        <div class="muted small">${apTag(f.from, leg.from)} → ${apTag(f.to, leg.to)} · ${dur(f.durationMinutes)} · ${f.stops ? `${f.stops} stop${f.stops > 1 ? 's' : ''}` : 'Direct'}</div>
      </div>
      <div class="f-airline">
        ${f.airlineLogo ? `<img src="${esc(f.airlineLogo)}" alt="" width="22" height="22" />` : ''}
        <span>${esc(f.airlines.join(' + '))}<br><span class="muted small">${esc(f.flightNumbers.join(', '))}</span></span>
      </div>
      <div class="f-price">${f.price != null ? money(f.price, cur) : '<span class="muted">n/a</span>'}
        <a class="small" href="${googleLink(f)}" target="_blank" rel="noopener">View</a></div>
    </div>`;
}

// Same order as the server: airport preference first (when chosen), then price.
function sortFlights(list, by) {
  return [...list].sort(
    (a, b) =>
      (by === 'airports' ? a.rank - b.rank : 0) ||
      (a.price ?? Infinity) - (b.price ?? Infinity) ||
      a.stops - b.stops ||
      a.durationMinutes - b.durationMinutes,
  );
}

function legSection(title, leg, legReq, cur, by, limit = 12) {
  if (!leg) return '';
  const errs = leg.errors.length ? `<p class="error small">${leg.errors.map(esc).join('<br>')}</p>` : '';
  const links = leg.links.length
    ? `<p class="small">Open in Google Flights: ${leg.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(niceDate(l.date))}</a>`).join(' · ')}</p>`
    : '';
  if (!leg.flights.length) return `<div class="card"><h3>${title}</h3>${errs}<p class="muted">No flights match those days, airports and times. Try widening the time window or adding another airport.</p>${links}</div>`;
  const rows = sortFlights(leg.flights, by).map((f) => flightRow(f, cur, legReq));
  const more = rows.length > limit ? `<details><summary>Show ${rows.length - limit} more</summary>${rows.slice(limit).join('')}</details>` : '';
  const order = by === 'airports' ? 'your airport order, then price' : 'cheapest first';
  return `<div class="card"><h3>${title} <span class="muted small">${leg.flights.length} option${leg.flights.length === 1 ? '' : 's'}, ${order}</span></h3>${errs}${rows.slice(0, limit).join('')}${more}${links}</div>`;
}

function sortSwitch(by) {
  return `<div class="seg" id="sort-switch" role="group" aria-label="Sort results">
    <button type="button" data-sort="airports" class="${by === 'airports' ? 'on' : ''}">My airport order</button>
    <button type="button" data-sort="price" class="${by === 'price' ? 'on' : ''}">Cheapest</button>
  </div>`;
}

function renderResults(data, req) {
  state.last = { data, req };
  state.currency = data.currency;
  const cur = data.currency;
  const by = prefs.sort === 'price' ? 'price' : 'airports';
  const demo = data.mode === 'demo' ? '<div class="card warn">Demo mode: these prices are made up. Add your SerpApi key as <code>SERPAPI_KEY</code> to get real Google Flights prices.</div>' : '';
  const head = `<div class="results-head"><h2><span class="step">3</span> Flights</h2>${sortSwitch(by)}</div>`;

  let trips = '';
  if (req.inbound) {
    const list = data.trips[by];
    const cheapest = data.trips.price[0];
    const saving = by === 'airports' && list.length && cheapest ? list[0].total - cheapest.total : 0;
    const tip = saving > 0
      ? `<p class="tip">Cheapest overall is <b>${money(cheapest.total, cur)}</b> via ${esc(cheapest.outbound.from)} → ${esc(cheapest.outbound.to)} and ${esc(cheapest.inbound.from)} → ${esc(cheapest.inbound.to)}, ${money(saving, cur)} less than your top pick. <button type="button" class="link" data-sort="price">Show cheapest first</button></p>`
      : '';
    const sub = by === 'airports' ? 'your airports first, then cheapest total' : 'cheapest total first';
    trips = list.length
      ? `<div class="card best"><h3>Best trips <span class="muted small">${sub}</span></h3>${tip}
          ${list
            .map(
              (t, i) => `
            <div class="trip ${i === 0 ? 'top' : ''}">
              <div class="trip-total">${money(t.total, cur)}${i === 0 ? `<span class="tag">${by === 'airports' ? 'Top pick' : 'Cheapest'}</span>` : ''}</div>
              <div class="trip-legs">${flightRow(t.outbound, cur, req.outbound)}${flightRow(t.inbound, cur, req.inbound)}</div>
            </div>`,
            )
            .join('')}</div>`
      : '<div class="card"><h3>Best trips</h3><p class="muted">No outbound and return pair works with these settings.</p></div>';
  }
  $('results').innerHTML = `${head}${demo}${trips}<div class="legs-results">${legSection('Going out', data.outbound, req.outbound, cur, by)}${req.inbound ? legSection('Coming home', data.inbound, req.inbound, cur, by) : ''}</div>`;
}

$('results').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b || !state.last) return;
  prefs = { ...prefs, sort: b.dataset.sort };
  savePrefs(prefs);
  renderResults(state.last.data, state.last.req);
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

loadFixtures();
