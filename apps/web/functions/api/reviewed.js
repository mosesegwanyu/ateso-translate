// Looks up speaker-approved translations. POST {sentences:[...], src, tgt} -> {matches:[text|null,...]} (same order).
// Never blocks translation: any problem returns all nulls. Approvals go live within ~60 s (per-instance cache).
const norm = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
const cache = new Map();
async function approved(env, src, tgt) {
  const k = src + tgt, c = cache.get(k);
  if (c && Date.now() - c.t < 60000) return c.m;
  const { results } = await env.DB.prepare("SELECT source, COALESCE(reviewed_text, correction) AS t FROM corrections WHERE status='approved' AND src_lang=? AND tgt_lang=? ORDER BY id LIMIT 20000").bind(src, tgt).all();
  const m = new Map(); for (const r of results) { const n = norm(r.source); if (n && r.t) m.set(n, r.t); }   // later approvals override earlier
  cache.set(k, { t: Date.now(), m }); return m;
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch (e) { b = {}; }
  const list = Array.isArray(b.sentences) ? b.sentences.slice(0, 200).map(x => String(x).slice(0, 4000)) : [];
  const none = () => new Response(JSON.stringify({ matches: list.map(() => null) }), { headers: { 'Content-Type': 'application/json' } });
  if (!env.DB || !['eng', 'teo'].includes(b.src) || !['eng', 'teo'].includes(b.tgt) || b.src === b.tgt) return none();
  try {
    const m = await approved(env, b.src, b.tgt);
    return new Response(JSON.stringify({ matches: list.map(x => m.get(norm(x)) || null) }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return none(); }
}
