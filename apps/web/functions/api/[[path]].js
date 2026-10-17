// Cloudflare Pages Function: proxies /api/* to the translation service, hiding its URL and token.
// Env vars (Pages → Settings → Variables): TRANSLATOR_URL (e.g. https://you-ateso.hf.space), TRANSLATOR_TOKEN (optional, same as API_TOKEN on the service).
const ALLOWED = new Set(['health', 'detect', 'translate', 'extract', 'export']);
export async function onRequest({ request, env, params }) {
  const name = [].concat(params.path || []).join('/');
  if (!ALLOWED.has(name)) return new Response('Not found', { status: 404 });
  if (!env.TRANSLATOR_URL) return new Response('TRANSLATOR_URL not configured', { status: 500 });
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 9_000_000) return new Response('Too large', { status: 413 });
  const h = new Headers(request.headers); h.delete('host'); h.delete('cookie');
  if (env.TRANSLATOR_TOKEN) h.set('Authorization', 'Bearer ' + env.TRANSLATOR_TOKEN);
  try {
    return await fetch(env.TRANSLATOR_URL.replace(/\/$/, '') + '/' + name, { method: request.method, headers: h, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body });
  } catch (e) { return new Response('Translation server unreachable', { status: 502 }); }
}
