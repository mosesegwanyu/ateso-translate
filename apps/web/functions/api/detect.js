import WL from '../wordlists.json';
const S = { eng: new Set(WL.eng), teo: new Set(WL.teo) };
const tok = s => (String(s).toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}']+/gu) || []).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);
export async function onRequestPost({ request }) {
  let b; try { b = await request.json(); } catch (e) { b = {}; }
  const w = tok(String(b.text || '').slice(0, 20000)); let e = 0, t = 0;
  for (const x of w) { if (S.eng.has(x)) e++; if (S.teo.has(x)) t++; }
  const r = e + t < 2 ? { lang: 'unknown', confidence: 0 } : { lang: e >= t ? 'eng' : 'teo', confidence: Math.round(Math.max(e, t) / (e + t) * 100) / 100 };
  return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
}
