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
  const sl = b.src_lang === 'teo' ? 'teo' : 'eng', tl = sl === 'eng' ? 'teo' : 'eng';
  await env.DB.prepare('INSERT INTO corrections (created_at,src_lang,tgt_lang,source,machine,correction,note,contributor,status) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(new Date().toISOString(), sl, tl, source, clip(b.machine, 4000), correction, clip(b.note, 500), clip(b.contributor, 80), 'pending').run();
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
