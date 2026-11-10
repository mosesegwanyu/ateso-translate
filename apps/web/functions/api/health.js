export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ready: !!env.SUNBIRD_TOKEN, model: 'sunbird-api:sunflower-9b', via: 'cloudflare' }), { headers: { 'Content-Type': 'application/json' } });
}
