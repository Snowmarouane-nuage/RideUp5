# Permanent Deployment

Recommended stack for this project:

- Frontend: `Vercel`
- Backend: `Railway`
- Database: `MongoDB Atlas`

This is the simplest path to a stable public URL with automatic restarts and low maintenance.

## 1. Backend on Railway

Create a Railway project and deploy the `backend` folder as its own service.

### Root directory

Set the Railway service root directory to:

```text
backend
```

### Start command

Already configured in `backend/railway.json`:

```bash
uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
```

### Required environment variables

Copy from `backend/.env.example` and set production values:

```env
ENV=production
COOKIE_SECURE=true
CORS_ORIGINS=https://<your-frontend-domain>
FRONTEND_URL=https://<your-frontend-domain>

MONGO_URL=<your-mongodb-atlas-uri>
DB_NAME=ridemind

OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
STRIPE_API_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=RIDE'UP <noreply@your-domain.com>
ADMIN_EMAILS=you@example.com

VIDEO_ANALYSIS_GPT_MODEL=gpt-4.1
VIDEO_ANALYSIS_GPT_MODEL_FALLBACK=gpt-4o
VIDEO_ANALYSIS_MAX_FRAMES=96
VIDEO_ANALYSIS_MAX_TOKENS=6000
VIDEO_ANALYSIS_API_TIMEOUT=300
```

Optional if you want denser video analysis:

```env
VIDEO_ANALYSIS_MAX_FRAMES=120
```

### Important note

`backend/uploads` is local filesystem storage. On Railway it is ephemeral.

That means uploaded videos may not persist across deploys/restarts.
The current analysis flow still works for immediate processing, but long-term storage should move to object storage later (S3, R2, Supabase Storage, etc.).

## 2. Database on MongoDB Atlas

Create a free/shared cluster in MongoDB Atlas and copy its connection string into:

```env
MONGO_URL=...
```

This avoids relying on local SQLite fallback in production.

## 3. Frontend on Vercel

Create a Vercel project and deploy the `frontend` folder.

### Root directory

Set the Vercel project root directory to:

```text
frontend
```

### Build settings

Vercel should use:

- Build command: `npm run build`
- Output directory: `build`

`frontend/vercel.json` is included to rewrite all routes to `index.html` for React Router.

### Required environment variables

```env
REACT_APP_BACKEND_URL=https://<your-backend-domain>
REACT_APP_SITE_URL=https://<your-frontend-domain>
```

## 4. Cross-domain auth

The backend already sets secure cookies for production:

- `secure=true`
- `samesite=none`

So frontend/backend can live on separate domains as long as:

- frontend uses HTTPS
- backend uses HTTPS
- `CORS_ORIGINS` is set to the exact frontend URL

## 5. Deployment order

1. Deploy MongoDB Atlas
2. Deploy backend on Railway
3. Copy backend public URL
4. Deploy frontend on Vercel with `REACT_APP_BACKEND_URL`
5. Update backend `CORS_ORIGINS` and `FRONTEND_URL` with the final Vercel URL
6. Redeploy backend if needed

## 6. Best current choice

For this repo, this is the best tradeoff:

- easiest to set up
- low ops overhead
- stable public link
- automatic restarts
- good cost for a solo project

If you want the absolute cheapest possible setup later, we can also switch the backend to Render or a single VPS, but Vercel + Railway + Atlas is the fastest clean path right now.
