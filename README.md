# Ateso Translate

English ⇄ Ateso translation for text and full documents (.docx, .pdf, .txt), with language detection, confidence flags and a human-review loop.

```
Browser ── Cloudflare Pages (apps/web) ── /api/* Pages Function ──► Render service (services/translator)
                static UI                     hides URL + token            FastAPI → Sunbird AI API
```

## Honest status
- Engine: Sunbird AI's hosted API (`POST /tasks/translate`, model `sunflower-9b`), free account, rate-limited. Hugging Face Docker Spaces now need a paid plan, so the model is not self-hosted. A self-hosted option (`ENGINE=local`, `Dockerfile.selfhost`, Sunbird's NLLB fine-tune) is kept for when there is funding or a GPU.
- Privacy: text you translate is sent to Sunbird's servers. Say so to users (the footer does) and read Sunbird's terms.
- Quality: not yet measured by this project. Use the gold benchmark below. The API gives no confidence scores, so nothing is underlined while this engine is used.
- Verified by tests: text processing, and the engine's retry/rate-limit logic against a mocked API. Not run end to end against the live API or deployed: first deploy may need small fixes. The exact free-tier rate limit is unknown to me; long documents are sent in sections of up to 120 words to limit requests.
- Sunbird tokens: their docs disagree on whether tokens expire (7 days vs never). Set `SUNBIRD_USERNAME`/`SUNBIRD_PASSWORD` too and the service logs in again automatically.

## Deploy (free)
1. **Sunbird account:** register at https://api.sunbird.ai/register, then create a token (see https://docs.sunbird.ai/quickstart).
2. **API service on Render (free web service):** New → Blueprint → pick this repo (it reads `render.yaml`). Set secrets `API_TOKEN` (random string you make), `SUNBIRD_TOKEN`, and optionally `SUNBIRD_USERNAME`, `SUNBIRD_PASSWORD`. Free services sleep when idle; the site shows a waking-up message.
3. **Website on Cloudflare Pages:** connect the repo, root directory `apps/web`, no build command, output directory `.`. Env vars: `TRANSLATOR_URL` (your Render URL) and `TRANSLATOR_TOKEN` (= `API_TOKEN`). Add a rate-limit rule on `/api/*`.
4. Local test: `cd services/translator && pip install -r requirements.txt && SUNBIRD_TOKEN=... API_TOKEN= uvicorn app.main:app --port 7860`.

## Build the gold benchmark (what funders will ask for)
1. `python tools/make_review_sheet.py <salt/v1.2> 500` → `eval/review_sheet.csv`
2. Two fluent Ateso speakers fix the `ateso_corrected` column and set `status`. Have them double-review 10% to measure agreement.
3. `python eval/run_eval.py https://your-space.hf.space eval/review_sheet.csv` → BLEU and chrF++ in both directions.
Re-run after every model change so progress is measured, not claimed.

## Roadmap
1. Gold benchmark + calibrated confidence. 2. Shared corrections database (Cloudflare D1) and reviewer login. 3. Fine-tune on reviewed corrections (free Kaggle/Colab GPUs; keep Sunbird's token setup). 4. Compare against `Sunbird/translate-nllb-3.3b-salt` and TranslateGemma variants. 5. Dictionary/idiom layer (`data/`), glossary enforcement. 6. Speech: Sunbird's API already offers Ateso speech-to-text (`/tasks/audio/transcriptions`) and text-to-speech (`/tasks/audio/speech`); wire them in and evaluate. 7. OCR for scanned PDFs.

Privacy: our service does not log or store text, but text goes to Sunbird. Write a policy before storing anything.
