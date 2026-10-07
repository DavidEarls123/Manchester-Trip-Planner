import { config } from '../lib/api.js';
import { send } from './_send.js';

export default async function handler(req, res) {
  send(res, await config());
}
