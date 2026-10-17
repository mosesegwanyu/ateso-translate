"""Self-hosted engine (needs a GPU or a paid host). Translation engine: Sunbird NLLB fine-tune (eng<->teo and more). Swap MODEL_ID to change model.
Language tokens are from the Sunbird model card (Sunbird/translate-nllb-1.3b-salt)."""
import os,math,threading,collections
LANG_TOKENS={'eng':256047,'ach':256111,'lgg':256008,'lug':256110,'nyn':256002,'teo':256006}
MODEL_ID=os.getenv('MODEL_ID','Sunbird/translate-nllb-1.3b-salt'); TOKENIZER_ID=os.getenv('TOKENIZER_ID',MODEL_ID)
_lock=threading.Lock(); _m=None; _cache=collections.OrderedDict()
def load():
    global _m
    import torch,transformers
    tk=transformers.NllbTokenizer.from_pretrained(TOKENIZER_ID); md=transformers.M2M100ForConditionalGeneration.from_pretrained(MODEL_ID).eval()
    if os.getenv('QUANTIZE','1')=='1': md=torch.quantization.quantize_dynamic(md,{torch.nn.Linear},dtype=torch.qint8)
    torch.set_num_threads(int(os.getenv('THREADS','2'))); _m=(torch,tk,md)
def ready(): return _m is not None
def translate(sents,src,tgt,beams=None):
    """-> list of (text, confidence). Confidence = exp(length-normalised log-prob): a model-certainty signal, NOT accuracy."""
    beams=beams or int(os.getenv('BEAMS','3')); res=[None]*len(sents); todo=[]
    for i,s in enumerate(sents):
        k=(src,tgt,beams,s)
        if k in _cache: res[i]=_cache[k]; _cache.move_to_end(k)
        else: todo.append(i)
    if todo:
        torch,tk,md=_m
        with _lock, torch.inference_mode():
            for j in range(0,len(todo),4):
                idx=todo[j:j+4]; enc=tk([sents[i] for i in idx],return_tensors='pt',padding=True,truncation=True,max_length=200)
                enc['input_ids'][:,0]=LANG_TOKENS[src]
                out=md.generate(**enc,forced_bos_token_id=LANG_TOKENS[tgt],max_length=256,num_beams=beams,
                                no_repeat_ngram_size=4,return_dict_in_generate=True,output_scores=True)
                txt=tk.batch_decode(out.sequences,skip_special_tokens=True)
                sc=getattr(out,'sequences_scores',None)
                for n,i in enumerate(idx):
                    c=round(min(1.0,math.exp(float(sc[n]))),3) if sc is not None else None
                    res[i]=(txt[n],c); _cache[(src,tgt,beams,sents[i])]=res[i]
        while len(_cache)>2000: _cache.popitem(last=False)
    return res
