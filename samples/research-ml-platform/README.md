# Research ML Platform

A small production-style ML platform for training, registering, deploying,
canary-testing, promoting, and automatically rolling back machine-translation
models — built around the Persian↔German↔Polish poetic translation research
project (NLLB-200 vs M2M-100).

```
Train → Register → Deploy Canary (5%) → Monitor → Promote or Rollback
```

## Architecture

| Service | Responsibility | Port |
|---|---|---|
| **registry** | Source of truth for model versions & deployment state (SQLite) | 8001 |
| **inference** | Serves `/translate`; routes stable/canary traffic via Redis | 8002 |
| **research** | Stores translations, human ratings, discussion board (SQLite) | 8003 |
| **dashboard** | Streamlit operator/researcher console | 8501 |
| **rollback-worker** | Polls Prometheus, triggers rollback on unhealthy canary | 8004 |
| **redis** | Traffic-routing cache | 6379 |
| **minio** | Model artifact storage | 9000/9001 |
| **mlflow** | Experiment tracking | 5000 |
| **prometheus** | Metrics collection | 9090 |

**Boundary rule:** Registry decides deployment state. Redis routes traffic.
Inference serves, never decides. Prometheus observes. The rollback worker
reacts. Nothing outside the Registry writes to model/deployment state
directly — see `services/registry/app/lifecycle.py`.

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

Then:
- Dashboard: http://localhost:8501
- Registry docs: http://localhost:8001/docs
- Inference docs: http://localhost:8002/docs
- Research docs: http://localhost:8003/docs
- MinIO console: http://localhost:9001
- MLflow: http://localhost:5000
- Prometheus: http://localhost:9090

### Demo the full lifecycle

```bash
# 1. Register a first version
curl -X POST localhost:8001/models/register \
  -H "Content-Type: application/json" \
  -d '{"name":"translation","version":"v1","artifact_uri":"s3://models/translation/v1"}'

# 2. Deploy it as canary at 100% (i.e. make it the only version), then promote
curl -X POST "localhost:8001/models/v1/deploy-canary" # (see API docs for exact path/body)
curl -X POST localhost:8001/models/translation/v1/promote

# 3. Register + deploy a real 5% canary
curl -X POST localhost:8001/models/register -d '{...version v2...}'
curl -X POST localhost:8001/models/translation/v2/deploy-canary -d '{"canary_percentage":5}'

# 4. Send traffic
curl -X POST localhost:8002/translate -d '{"source_lang":"persian","target_lang":"german","text":"..."}'

# 5. Promote or let the rollback worker react to bad metrics
curl -X POST localhost:8001/models/translation/v2/promote
# or
curl -X POST localhost:8001/models/translation/rollback
```

Or just use the **Deployment** page in the dashboard for all of this.

## Training

```bash
docker compose run --rm training python train.py --source persian --target german --epochs 3
```

This fine-tunes NLLB with LoRA, logs to MLflow, uploads the adapter to MinIO,
and registers the resulting version with the Registry — it does **not**
touch production traffic. Deploying the new version as a canary is a
separate, explicit step.

## Testing

```bash
pip install pytest fastapi httpx
python -m pytest tests/ -v
```

`tests/integration/test_lifecycle.py` is the golden integration test: it
proves `register → deploy → canary → promote` and
`register → deploy → canary → rollback` end-to-end against the real
Registry app + SQLite, no Docker required.

## Known limitations / honest scope notes

- **No real parallel poetry corpus yet.** `training/train.py` falls back to
  a 2-example synthetic dataset if none is found, purely so the pipeline is
  runnable end-to-end. Don't trust a model trained on that.
- **Rollback health check is error-rate based**, not translation-quality
  based. For the poetic-translation use case specifically, consider adding a
  sampled chrF++/COMET score against a held-out set as a second signal (see
  the original research app's `RESEARCH NOTES` section for why raw BLEU
  between two MT systems isn't a quality metric).
- **SQLite-first by design** for this hardware/storage budget. `database.py`
  in each service isolates all SQL behind small query functions specifically
  so swapping to PostgreSQL later is a contained change, not a rewrite.
- **Poetic feature detectors are heuristic** (regex suffix patterns + a short
  metaphor lexicon per language) — a useful signal for the UI, not yet
  validated against expert-annotated poetry.
- No authentication/RBAC (explicit MVP non-goal per the original blueprint).
