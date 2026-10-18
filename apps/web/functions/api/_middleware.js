// Basic per-visitor burst limit for the endpoints that spend the Sunbird quota.
// Limitation: counters live in memory of one Cloudflare instance, so this stops loops and casual abuse, not a determined attacker.
const hits = new Map(), LIMIT = 60, WINDOW = 60000;
export async function onRequest({ request, next }) {
  const p = new URL(request.url).pathname;
  if (request.method === 'POST' && /^\/api\/(translate|detect|extract|export)\/?$/.test(p)) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown', now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW);
    if (recent.length >= LIMIT) return new Response(JSON.stringify({ error: 'Too many requests, slow down' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } });
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
  }
  return next();
}
