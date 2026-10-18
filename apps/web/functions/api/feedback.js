// Shared corrections store (Cloudflare D1). Binding name: DB. Admin secret: ADMIN_TOKEN.
// POST  /api/feedback            public: submit a correction
// GET   /api/feedback            admin: list/export (Authorization: Bearer ADMIN_TOKEN)
// PATCH /api/feedback            admin: {id,status,reviewed_text?,reviewer?}
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const isAdmin = (req, env) => !!env.ADMIN_TOKEN && req.headers.get('Authorization') === 'Bearer ' + env.ADMIN_TOKEN;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'Feedback storage not configured' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
  const source = clip(b.source, 4000).trim(), correction = clip(b.correction, 4000).trim();
  if (!source || !correction) return json({ error: 'Missing text' }, 400);
  // Abuse limits, counted from the table itself (no extra writes): per visitor 10/hour and 40/day, everyone 300/hour.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bytes = new TextEncoder().encode(ip + '|' + (env.ADMIN_TOKEN || 'salt'));
  const ipHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
  const now = Date.now(), hourAgo = new Date(now - 36e5).toISOString(), dayAgo = new Date(now - 864e5).toISOString();
  const c = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM corrections WHERE ip_hash=? AND created_at>?) AS h, (SELECT COUNT(*) FROM corrections WHERE ip_hash=? AND created_at>?) AS d, (SELECT COUNT(*) FROM corrections WHERE created_at>?) AS g')
    .bind(ipHash, hourAgo, ipHash, dayAgo, hourAgo).first();
  if (c && (c.h >= 10 || c.d >= 40 || c.g >= 300)) return json({ error: 'Too many corrections right now. Please try again later.' }, 429);
  const sl = b.src_lang === 'teo' ? 'teo' : 'eng', tl = sl === 'eng' ? 'teo' : 'eng';
  await env.DB.prepare('INSERT INTO corrections (created_at,src_lang,tgt_lang,source,machine,correction,note,contributor,status,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(new Date().toISOString(), sl, tl, source, clip(b.machine, 4000), correction, clip(b.note, 500), clip(b.contributor, 80), 'pending', ipHash).run();
  return json({ ok: true });
}
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'Feedback storage not configured' }, 503);
  const st = new URL(request.url).searchParams.get('status');
  const q = st ? env.DB.prepare('SELECT * FROM corrections WHERE status=? ORDER BY id DESC LIMIT 5000').bind(st) : env.DB.prepare('SELECT * FROM corrections ORDER BY id DESC LIMIT 5000');
  return json((await q.all()).results);
}
export async function onRequestPatch({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
  if (!['pending', 'approved', 'rejected'].includes(b.status) || !Number.isInteger(b.id)) return json({ error: 'Bad request' }, 400);
  await env.DB.prepare('UPDATE corrections SET status=?, reviewed_text=?, reviewer=?, reviewed_at=? WHERE id=?')
    .bind(b.status, b.reviewed_text == null ? null : clip(b.reviewed_text, 4000), clip(b.reviewer, 80), new Date().toISOString(), b.id).run();
  return json({ ok: true });
}
