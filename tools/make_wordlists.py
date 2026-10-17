"""Make language-detection word lists from SALT. Usage: python tools/make_wordlists.py <salt v1.2 dir>"""
import json,re,sys,glob,collections
src=sys.argv[1]; tok=lambda s:[w.strip("'") for w in re.findall(r"[\w']+",s.lower().replace('’',"'")) if w.strip("'")]
E_,T_=collections.Counter(),collections.Counter()
for f in glob.glob(src+'/salt-*-v1.2.jsonl'):
    for l in open(f,encoding='utf8'):
        t=json.loads(l)['text']; E_.update(set(tok(t.get('eng','')))); T_.update(set(tok(t.get('teo',''))))
def pick(a,b,n):  # words clearly belonging to a, not b
    r=[(w,c) for w,c in a.items() if c>=5 and c>=8*(b.get(w,0)+1)]
    return [w for w,c in sorted(r,key=lambda x:-x[1])[:n]]
out={'eng':pick(E_,T_,2500),'teo':pick(T_,E_,2500)}
json.dump(out,open('services/translator/app/wordlists.json','w'),ensure_ascii=False)
print({k:len(v) for k,v in out.items()})
