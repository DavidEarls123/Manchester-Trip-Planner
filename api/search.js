import { search } from '../lib/api.js';
import { send } from './_send.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'Use POST' } });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    send(res, await search(body, req.headers['x-app-pin']));
  } catch (err) {
    send(res, { status: 400, body: { error: err.message } });
  }
}
