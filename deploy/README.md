# Deploy

This app is deployed as a static Vite build and served by a web server (e.g. Caddy, Nginx).

## Setup

1. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
# Edit .env with your TARGET_HOST and REMOTE_DIR
```

2. Deploy:

```bash
npm run deploy
```

This builds the app and rsyncs `dist/` to `TARGET_HOST:REMOTE_DIR`.

## Variables

| Variable | Required | Description |
|---|---|---|
| `TARGET_HOST` | yes | SSH target (`user@host`) |
| `REMOTE_DIR` | yes | Remote path to serve static files from |
| `CONLLU_DB_PATH` | for import | Path to `editions.db` |
| `CONLLU_MAP_PATH` | no | Path to edition map JSON (default: `./conllu-edition-map.json`) |

## Import

```bash
npm run import -- <path> --db /path/to/editions.db
# or with CONLLU_DB_PATH set in .env:
npm run import -- <path>
```
