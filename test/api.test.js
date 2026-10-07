import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/search.js';
import { search } from '../lib/api.js';

function mockRes() {
  return {
    headers: {}, statusCode: 0, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const body = { outbound: { from: ['DUB'], to: ['MAN'], dates: ['2026-10-09'] }, inbound: { from: ['MAN'], to: ['DUB'], dates: ['2026-10-11'] } };

test('PIN is enforced only when APP_PIN is set', async () => {
  delete process.env.APP_PIN;
  assert.equal((await search(body)).status, 200);
  process.env.APP_PIN = '1878';
  try {
    assert.equal((await search(body)).status, 401);
    assert.equal((await search(body, '0000')).status, 401);
    assert.equal((await search(body, '1878')).status, 200);
  } finally {
    delete process.env.APP_PIN;
  }
});

test('Vercel search function returns trips and rejects GET', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.trips.length > 0);
  const res2 = mockRes();
  await handler({ method: 'GET', headers: {} }, res2);
  assert.equal(res2.statusCode, 405);
});
