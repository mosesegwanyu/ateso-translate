"""Make a reviewer spreadsheet from the SALT *test* split (held out from training).
Reviewers fix the Ateso column; the corrected file becomes your gold benchmark (eval/gold.tsv).
Usage: python tools/make_review_sheet.py <salt v1.2 dir> [n=500]"""
import json,sys,csv,random
d=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 500
rows=[json.loads(l)['text'] for l in open(f'{d}/salt-test-v1.2.jsonl',encoding='utf8')]
random.Random(7).shuffle(rows)
with open('eval/review_sheet.csv','w',newline='',encoding='utf8') as f:
    w=csv.writer(f); w.writerow(['id','english','ateso_original','ateso_corrected','status(ok/fixed/bad_english/unsure)','reviewer','notes'])
    for i,r in enumerate(rows[:n]): w.writerow([i,r['eng'],r['teo'],'','','',''])
print('wrote eval/review_sheet.csv with',min(n,len(rows)),'rows')
