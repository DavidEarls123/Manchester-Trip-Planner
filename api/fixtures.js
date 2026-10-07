import { fixtures } from '../lib/api.js';
import { send } from './_send.js';

export default async function handler(req, res) {
  try {
    send(res, await fixtures());
  } catch (err) {
    send(res, { status: 500, body: { error: err.message } });
  }
}
