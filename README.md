# AI Evaluation POC — IT Knowledge Assistant

A demonstration of how an AI application is evaluated **before** it ships: an IT
service-desk assistant answers questions from a local knowledge base, and every answer
is checked three ways — automated rules, an LLM judge, and a human reviewer — then
combined into one score.

---

## Running it on another machine

### 1. What you need installed

| Requirement | Version | Check with | If missing |
| --- | --- | --- | --- |
| Python | **3.11 or 3.12** (not 3.13+) | `python3 --version` | [python.org](https://www.python.org/downloads/) or `brew install python@3.12` |
| Node.js | 20 or newer | `node -v` | [nodejs.org](https://nodejs.org) |
| A Groq API key | — | — | Free key at [console.groq.com/keys](https://console.groq.com/keys) |

> **Python 3.13+ will not work.** DeepEval's dependencies have no wheels for it yet.
> If `python3 --version` shows 3.13 or 3.14, install 3.12 alongside it and use that.

### 2. Copy the project

Copy the whole folder **except** these — they are large, machine-specific, or secret,
and get recreated on the new machine:

```
.venv/                    467 MB, built for this machine's OS and Python
frontend/node_modules/    141 MB, reinstalled by npm
.env                      your API key — never copy this over a network
data/transcript.json      demo session state
reports/                  generated output
.pytest_cache/  .coverage  .deepeval/
```

Everything worth copying is about **1 MB**. A `.gitignore` covering exactly this list is
already in the project, so if you push to git and clone on the other laptop, the right
things are excluded automatically.

### 3. Set up Python

```bash
cd Ai-eval-poc

python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 4. Add your API key

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```
GROQ_API_KEY=gsk_your_key_here
```

The file is git-ignored. Don't paste the key into chat, email, or a screenshot.

### 5. Set up the frontend

```bash
cd frontend
npm install
cd ..
```

### 6. Start both halves

You need **two terminals**, both in the project folder.

**Terminal 1 — the API (port 8000):**

```bash
PYTHONPATH=src .venv/bin/uvicorn eval_poc.api:app --port 8000 --reload
```

**Terminal 2 — the dashboard (port 5173):**

```bash
cd frontend && npm run dev
```

Then open **http://localhost:5173**.

The header should read **"Groq connected"** in green. If it says "Offline stub mode",
the key was not picked up — check `.env` and restart the API.

### 7. Confirm it works

```bash
.venv/bin/python -m pytest        # 112 tests, all should pass
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Header shows "Offline stub mode" | `.env` missing or unread | Check `GROQ_API_KEY` in `.env`, restart the API |
| `ModuleNotFoundError: eval_poc` | `PYTHONPATH` not set | Run uvicorn with `PYTHONPATH=src` as shown above |
| Dashboard says "Cannot reach the evaluation API" | API not running | Start terminal 1 first |
| Judge shows "NOT SCORED — RateLimitError" | Daily Groq token cap hit | Wait for the daily reset, switch the judge model in `config.json`, or upgrade the Groq tier |
| `pip install` fails on deepeval | Python 3.13+ | Recreate the venv with Python 3.12 |
| Port already in use | Old server still running | `pkill -f uvicorn` / `pkill -f vite` |

---

## What is in the project

```
src/eval_poc/            the evaluation engine (Python)
  assistants/registry.py   V1 and V2 of the assistant being tested
  knowledge/               retrieval over the local JSON knowledge base
  generation/              builds the prompt and calls the model
  evaluators/rules/        17 automated checks, grouped in four families
  evaluators/llm_judge.py  DeepEval metrics, judged by a Groq model
  evaluators/human.py      the 5-point human review rubric
  scoring.py               combines the three methods into one score
  api.py                   the HTTP API the dashboard talks to

frontend/src/            the dashboard (React + TypeScript + Tailwind)
  components/tabs/         Start here · Demo · Compare · Report · Knowledge base

data/knowledge_base.json  the 12 IT articles the assistant may use
data/test_cases.json      the 12 curated questions with known-good answers
config.json               thresholds, models, rule limits
tests/                    112 tests
```

## The five tabs

| Tab | What it does |
| --- | --- |
| **Start here** | Plain-English guide: what AI evaluation is, why it matters, the methods and tools |
| **Demo** | Ask a question, watch retrieval and generation, then run the three evaluations |
| **Compare versions** | The same questions through V1 and V2, scored identically |
| **Report** | Scores across everything asked, and what is failing |
| **Knowledge base** | The 12 articles the assistant is allowed to use |

## Command line

The batch suite runs without the dashboard:

```bash
PYTHONPATH=src .venv/bin/python scripts/run_eval.py             # all 12 cases
PYTHONPATH=src .venv/bin/python scripts/run_eval.py --no-judge  # skip the LLM judge
```

Writes `reports/latest_run.json` and `reports/report.md`.

---

## How scoring works

Each answer is scored by up to three methods, each normalised to 0–100:

- **Rule checks (30%)** — 17 deterministic gates. Instant, free, no model involved.
- **LLM judge (40%)** — correctness, completeness, faithfulness, relevancy, scored by a
  second model with written reasoning.
- **Human review (30%)** — correctness, completeness, clarity and tone on a 1–5 rubric,
  plus "would you send this?".

A method that has not run is **excluded**, not counted as zero, and the remaining
weights are renormalised — the app always says what a score rests on.

**Any failed security check blocks release** regardless of the total. A leaked credential
is not redeemed by fast, well-cited prose.

## Known limitations

- **Small scale.** 12 questions, 12 articles — sized to demonstrate the harness, not to
  qualify a production model.
- **Judge variance.** The judge is a model, so the same answer can score differently
  between runs. It reduces human review effort; it does not replace it.
- **V1 vs V2 is close.** V2 reliably fixes citation failures, but the two versions come
  out near-level on final score because judge noise across a handful of questions is
  larger than the real gap. Measured, not assumed — see the Compare tab.
- **Rate limits.** Groq's free tier caps daily tokens. One comparison run costs roughly
  50 judge calls.
