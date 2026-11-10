// Translation straight to Sunbird's API from Cloudflare (no Render needed).
// Secrets (Pages → Settings → Variables and Secrets): SUNBIRD_TOKEN; optional SUNBIRD_USERNAME + SUNBIRD_PASSWORD for automatic token renewal.
// Optional D1 cache (uses binding DB): saves Sunbird quota on repeated text; stores only a hash of the source plus the translation.
const API = 'https://api.sunbird.ai'; let tok = '', cacheReady = false;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Err extends Error { constructor(m, s) { super(m); this.status = s; } }
async function login(env) {
  if (!env.SUNBIRD_USERNAME || !env.SUNBIRD_PASSWORD) return false;
  const r = await fetch(API + '/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: env.SUNBIRD_USERNAME, password: env.SUNBIRD_PASSWORD }) });
  const j = r.ok ? await r.json().catch(() => ({})) : {};
  if (j.access_token) { tok = j.access_token; return true; } return false;
}
async function one(env, text, src, tgt) {
  tok = tok || env.SUNBIRD_TOKEN || '';
  for (let a = 0; a < 4; a++) {
    const r = await fetch(API + '/tasks/translate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ source_language: src, target_language: tgt, text }) });
    if (r.status === 401) { if (!(await login(env))) throw new Err('Sunbird token rejected or expired', 502); continue; }
    if (r.status === 429 || r.status === 503) { await sleep(Math.min(parseInt(r.headers.get('Retry-After')) || 3 * (a + 1), 10) * 1000); continue; }
    if (!r.ok) throw new Err('Sunbird error ' + r.status, 502);
    const o = (await r.json()).output || {}, t = o.translated_text || o.text;
    if (!t) throw new Err(o.Error || 'Empty translation from Sunbird', 502);
    return String(t).trim();
  }
  throw new Err('Sunbird is busy or the free limit was reached. Please try again later.', 429);
}
async function key(src, tgt, text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return src + tgt + [...new Uint8Array(h)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
  const L = ['eng', 'teo'];
  if (!L.includes(b.src) || !L.includes(b.tgt) || b.src === b.tgt || !Array.isArray(b.sentences)) return json({ error: 'src/tgt must be different, from eng|teo' }, 400);
  const items = b.sentences.map(s => String(s).trim());
  if (items.length > 8 || items.some(s => !s || s.length > 1500)) return json({ error: 'Too many, empty or too long sentences' }, 400);
  if (!env.SUNBIRD_TOKEN && !tok) return json({ error: 'Translation is not configured yet' }, 503);
  const out = new Array(items.length).fill(null); let keys = [];
  try {
    if (env.DB) {
      if (!cacheReady) { await env.DB.exec('CREATE TABLE IF NOT EXISTS translation_cache (k TEXT PRIMARY KEY, v TEXT)'); cacheReady = true; }
      keys = await Promise.all(items.map(s => key(b.src, b.tgt, s)));
      const { results } = await env.DB.prepare('SELECT k, v FROM translation_cache WHERE k IN (' + keys.map(() => '?').join(',') + ')').bind(...keys).all();
      const m = new Map(results.map(r => [r.k, r.v])); keys.forEach((k, i) => { if (m.has(k)) out[i] = m.get(k); });
    }
  } catch (e) { keys = []; }
  try {
    const todo = out.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    await Promise.all(todo.map(async i => { out[i] = await one(env, items[i], b.src, b.tgt); }));
    if (env.DB && keys.length && todo.length) { try { await env.DB.batch(todo.map(i => env.DB.prepare('INSERT OR REPLACE INTO translation_cache (k, v) VALUES (?, ?)').bind(keys[i], out[i]))); } catch (e) {} }
  } catch (e) { return json({ error: e.message || 'Translation failed' }, e.status || 502); }
  return json({ model: 'sunbird-api:sunflower-9b', results: out.map(t => ({ text: t, confidence: null })) });
}
