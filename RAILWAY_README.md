# Railway Deployment Guide (Supabase + Railway)

This guide describes how to deploy the Cost Estimator v2 application to Railway with Supabase as the database.

## Architecture
- **Client:** Next.js application (`/client`) → Deploy to Railway
- **Server:** Express application (`/server`) → Deploy to Railway
- **Database:** PostgreSQL on Supabase

---

## 1. Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a project (or use existing).
2. Open the **SQL Editor** in Supabase Dashboard.
3. Copy and paste the contents of `database/supabase_schema.sql` and run it.
4. Note your project credentials:
   - **Project URL**: `https://your-project.supabase.co`
   - **Service Key**: Found in Settings → API → `service_role` key (NOT anon key)

---

## 2. Deploy Server to Railway

### Create Service
1. Go to [railway.app](https://railway.app) and create a new project.
2. Add a new service from GitHub repo.
3. Set **Root Directory**: `server`

### Environment Variables
Add these in Railway's service settings:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | A random 32+ character string |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Your client Railway URL (e.g., `https://client-prod.up.railway.app`) |

### Deploy
Railway auto-deploys on push. Check logs for successful startup:
```
✓ Supabase client initialized
Server running on port XXXX
```

---

## 3. Deploy Client to Railway

### Create Service
1. In the same Railway project, add another service from the same GitHub repo.
2. Set **Root Directory**: `client`

### Environment Variables
Add these in Railway's service settings:

| Variable | Value |
|----------|-------|
| `SERVER_URL` | Your server Railway URL (e.g., `https://server-prod.up.railway.app`) |

### Deploy
Railway auto-deploys on push.

---

## 4. Update ALLOWED_ORIGINS

After both services are deployed:
1. Copy your **client** Railway URL.
2. Go to **server** service settings.
3. Update `ALLOWED_ORIGINS` to include the client URL.

Example:
```
ALLOWED_ORIGINS=https://cost-estimator-client.up.railway.app,https://ihalerobotum.com
```

---

## 5. Custom Domain (Optional)

1. In Railway, go to your client service → Settings → Domains.
2. Add custom domain (e.g., `app.ihalerobotum.com`).
3. Update DNS records as instructed.
4. Add the custom domain to server's `ALLOWED_ORIGINS`.

---

## Troubleshooting

### Server won't start
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct.
- Check `JWT_SECRET` is set.

### CORS errors
- Ensure client URL is in `ALLOWED_ORIGINS`.
- Include both `https://` and without trailing slash.

### Database connection issues
- Verify Supabase project is active.
- Check the service key (not anon key).
- Ensure tables were created via SQL schema.

---

## Local Development

For local development, create `.env` files:

**server/.env:**
```env
JWT_SECRET=dev-secret-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
NODE_ENV=development
```

**client/.env.local:**
```env
SERVER_URL=http://localhost:3001
```

Run with:
```bash
# Terminal 1 (Server)
cd server && npm install && npm run dev

# Terminal 2 (Client)
cd client && npm install && npm run dev
```
