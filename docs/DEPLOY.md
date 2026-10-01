# Deploying YardFlow to Railway

YardFlow runs on Railway as three services in one project: a MySQL database, the API and the web app. A fourth service resets the demo data every night.

## 1. Create the project

1. Push the repository to GitHub.
2. In Railway, create a new project and choose **Deploy from GitHub repo**, then pick the repository. Railway creates one service; you will set it up as the API in step 3.
3. Add a database with **New → Database → MySQL**. Railway calls the service `MySQL` and gives it the variable `MYSQL_URL`.

## 2. Settings that all app services share

Every app service builds from the repository root, because the API and the web app share `packages/shared`.

| Setting | Value |
|---|---|
| Root directory | `/` (leave empty) |
| Builder | Dockerfile |

## 3. API service

Rename the first service to `api`.

| Setting | Value |
|---|---|
| Dockerfile path | `apps/api/Dockerfile` |
| Public networking | off (only the web service talks to it) |
| Private networking | on, port `4000` |

Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
| `SESSION_SECRET` | a long random string, for example from `openssl rand -hex 32` |
| `WEB_ORIGIN` | the public URL of the web service, for example `https://yardflow.up.railway.app` |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `TZ` | `Europe/Berlin` |
| `SEED_ON_START` | `if-empty` |

Leave `HTTPS_ONLY` unset: in production the session cookie is then `secure`, and the API trusts the proxy in front of it (`trust proxy` is on in production). Never set `DEMO_CLOCK_START` here; it is only for the E2E stack.

On every start the API applies pending migrations (`prisma migrate deploy`), seeds the database if it has no users yet, and starts the server.

## 4. Web service

Add a second service from the same repository with **New → GitHub Repo** and name it `web`.

| Setting | Value |
|---|---|
| Dockerfile path | `apps/web/Dockerfile` |
| Public networking | on, generate a domain, target port `80` |

Variables:

| Variable | Value |
|---|---|
| `API_UPSTREAM` | `http://api.railway.internal:4000` |
| `PORT` | `80` |

nginx serves the built React app and forwards `/api` and `/socket.io` (with WebSocket upgrade) to the API. Browser and API therefore share one origin, so the cookie stays `SameSite=Lax` and no CORS setup is needed in the browser.

After the domain exists, copy it into `WEB_ORIGIN` of the API service and redeploy the API.

## 5. Daily demo reset

Add a third service from the same repository and name it `demo-reset`.

| Setting | Value |
|---|---|
| Dockerfile path | `apps/api/Dockerfile` |
| Custom start command | `npm run db:reset` |
| Cron schedule | `0 3 * * *` (every night at 03:00 UTC) |
| Public networking | off |

Variables: `DATABASE_URL` = `${{MySQL.MYSQL_URL}}`, `NODE_ENV` = `production`, `TZ` = `Europe/Berlin`.

`npm run db:reset` drops all tables, applies the migrations and loads the seed again, so every visitor sees clean data with gate bookings in the current or next time slot. Logged-in users are logged out by the reset because sessions are stored in the database too.

## 6. Check the deployment

1. Open `https://<web domain>/api/v1/health`. It answers `{"status":"ok","database":"up"}`.
2. Open the web domain, sign in as `admin@yardflow.dev` with `demo1234`, and open the yard map.
3. Open `https://<web domain>/api/docs` for the API documentation.
4. Put the URL into the "Live demo" section of the README.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Login works but the next request is logged out | `WEB_ORIGIN` does not match the web domain, or the site is opened over plain HTTP while `HTTPS_ONLY` is on |
| 502 from `/api` | The API is still starting or `API_UPSTREAM` has the wrong host or port |
| No live updates | A proxy in between does not allow WebSocket upgrades; Socket.IO then falls back to polling |
| `Invalid environment configuration` in the API log | A variable from the table above is missing; the message names it |
