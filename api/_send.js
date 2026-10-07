// Vercel ignores files starting with "_" when creating functions.
export function send(res, { status, body }) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
