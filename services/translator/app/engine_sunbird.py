"""Engine that calls Sunbird AI's hosted translation API (POST /tasks/translate, model sunflower-9b).
Free account + token: https://docs.sunbird.ai/quickstart  — free tier is rate-limited, and text is sent to Sunbird."""
import os,time,threading,collections,requests
from concurrent.futures import ThreadPoolExecutor
API=os.getenv('SUNBIRD_API','https://api.sunbird.ai'); MODEL_ID='sunbird-api:sunflower-9b'
class RateLimited(RuntimeError): pass
_tok={'v':os.getenv('SUNBIRD_TOKEN','')}; _lock=threading.Lock(); _cache=collections.OrderedDict()
def _creds(): return os.getenv('SUNBIRD_USERNAME'),os.getenv('SUNBIRD_PASSWORD')
def _login():
    u,p=_creds()
    if not(u and p): return False
    r=requests.post(API+'/auth/token',data={'username':u,'password':p},timeout=30)
    tok=r.json().get('access_token') if r.ok else None
    if tok: _tok['v']=tok
    return bool(tok)
def ready(): return bool(_tok['v'] or all(_creds()))
def load():
    if not _tok['v']: _login()
def _one(text,src,tgt):
    for attempt in range(4):
        r=requests.post(API+'/tasks/translate',json={'source_language':src,'target_language':tgt,'text':text},headers={'Authorization':'Bearer '+_tok['v']},timeout=120)
        if r.status_code==401:
            with _lock:
                if not _login(): raise RuntimeError('Sunbird token rejected or expired; create a new one')
            continue
        if r.status_code in(429,503):
            try: wait=int(r.headers.get('Retry-After',''))
            except ValueError: wait=3*(attempt+1)
            time.sleep(min(wait,15)); continue
        r.raise_for_status(); o=r.json().get('output') or {}; t=o.get('translated_text') or o.get('text')
        if not t: raise RuntimeError(o.get('Error') or 'Empty translation from Sunbird API')
        return t.strip()
    raise RateLimited('Sunbird API is busy or the free-tier rate limit was reached. Wait a while and try again.')
def translate(sents,src,tgt,beams=None):
    """-> [(text, None)]. The API returns no confidence score."""
    def work(s):
        k=(src,tgt,s)
        if k in _cache: return _cache[k]
        v=(_one(s,src,tgt),None); _cache[k]=v
        while len(_cache)>2000: _cache.popitem(last=False)
        return v
    with ThreadPoolExecutor(3) as ex: return list(ex.map(work,sents))
