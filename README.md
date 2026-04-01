# Med Guard AI

Hackathon-ready medication interaction checker with:
- React frontend
- Node backend API
- Kaggle-backed interaction dataset

## Local Run

```bash
npm install
npm run dev:full
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3001`

## API Endpoints

- `GET /api/health`
- `GET /api/drugs/suggest?q=para`
- `POST /api/check-interactions`

Sample request:

```bash
curl -X POST http://localhost:3001/api/check-interactions \
  -H "Content-Type: application/json" \
  -d '{"medications":[{"name":"Trioxsalen"},{"name":"Verteporfin"}]}'
```

## Deploy on Render

This repo includes a Render blueprint file: `render.yaml`.

### Steps

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select the repo.
4. Render will pick `render.yaml` automatically.
5. Update env vars after first deploy:
   - `ALLOWED_ORIGINS=https://<your-frontend-domain>`
   - Keep `INTERACTIONS_FILE=/opt/render/project/src/data/kaggle_interactions.json`

### Post-deploy smoke test

```bash
curl https://<your-render-domain>/api/health
curl -X POST https://<your-render-domain>/api/check-interactions \
  -H "Content-Type: application/json" \
  -d '{"medications":[{"name":"Trioxsalen"},{"name":"Verteporfin"}]}'
```

## Environment Variables

- `PORT` (optional, Render sets automatically)
- `HOST` (default `0.0.0.0`)
- `ALLOWED_ORIGINS` (comma-separated origins, or `*`)
- `INTERACTIONS_FILE` (optional path override)
