"""Score the live service against reviewed data. pip install sacrebleu requests
Usage: python eval/run_eval.py <service url> eval/review_sheet.csv   (uses rows with status ok/fixed)"""
import sys,csv,requests,sacrebleu,json
url,path=sys.argv[1].rstrip('/'),sys.argv[2]
rows=[r for r in csv.DictReader(open(path,encoding='utf8')) if r['status(ok/fixed/bad_english/unsure)'] in('ok','fixed')]
ref_t=[(r['ateso_corrected'] or r['ateso_original']).strip() for r in rows]; eng=[r['english'].strip() for r in rows]
def run(src,tgt,xs):
    out=[]
    for i in range(0,len(xs),8):
        out+=[x['text'] for x in requests.post(url+'/translate',json={'sentences':xs[i:i+8],'src':src,'tgt':tgt},timeout=600).json()['results']]
    return out
res={}
for name,src,tgt,xs,refs in [('eng->teo','eng','teo',eng,ref_t),('teo->eng','teo','eng',ref_t,eng)]:
    hyp=run(src,tgt,xs); res[name]={'n':len(xs),'bleu':round(sacrebleu.corpus_bleu(hyp,[refs]).score,1),'chrF++':round(sacrebleu.corpus_chrf(hyp,[refs],word_order=2).score,1)}
print(json.dumps(res,indent=1)); json.dump(res,open('eval/last_scores.json','w'),indent=1)
