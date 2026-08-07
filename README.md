# Current Quest Backend

Server-authoritative backend for the [Current Quest](../README.md) Android puzzle game. Replaces trust-the-client `SharedPreferences` state for three things:

- **Level progress** — which levels are completed, best time, stars earned.
- **Star economy** — an append-only ledger backing each player's star balance, spent on hints.
- **Star pack purchases** — Google Play in-app purchases verified server-side before crediting stars.

Everything else (rendering, circuit solving, level content) stays on-device; this service only protects state a modified client could otherwise fake.

## Architecture

- **Node.js + TypeScript + Express + PostgreSQL**
- `src/config.ts` — reads all required env vars once at boot; throws immediately if any are missing or misconfigured (see `ALLOW_DEV_AUTH` guard).
- `src/middleware/auth.ts` — verifies the Firebase ID token the Android app already holds (Firebase Auth, anonymous or Google sign-in), against Firebase's public signing keys — no service-account credential needed for this. The user id for every mutation comes only from this verified token, never from the request body.
- `src/db/` — pooled `pg` connections + a `withTransaction` helper so multi-statement writes commit or roll back together.
- `src/services/` — business logic (star math, ledger, purchase verification), unit-testable without HTTP.
- `src/routes/` — thin handlers: parse/validate input via `zod`, call a service.
- Star ledger (`star_ledger` table) is append-only; `users.star_balance` is a materialized cache of the sum, always updated in the same transaction as the ledger insert. Every credit/debit carries a unique `dedupe_key` so retried requests never double-apply.

## API

All endpoints except `/health` and `GET /star-packs` require `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check for the hosting platform. |
| GET | `/me` | Current player's level progress + star balance. |
| POST | `/levels/:levelId/complete` | Body `{ timeMs }`. Server computes stars from elapsed time (same thresholds as the client) and credits the ledger if it's an improvement. |
| POST | `/hints/use` | Body `{ hintType: "next_step" \| "solve", idempotencyKey }`. Locks the balance row, checks funds, debits atomically. |
| GET | `/star-packs` | Public catalogue of purchasable star packs. |
| POST | `/purchases/verify` | Body `{ productId, purchaseToken }`. Verifies the token against the Google Play Developer API before crediting stars, then consumes the purchase. |

## Local setup

```bash
cp .env.example .env
# fill in DATABASE_URL — everything else has a working default or is optional (see .env.example)

npm install
npm run migrate:dev
npm run seed:dev
npm run dev
```

Encoding a service account JSON to the base64 env var format (only needed for
`GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64`, once Play Billing is wired into the app):

```bash
base64 -w0 service-account.json
```

For local curl testing without a real Firebase token, set `ALLOW_DEV_AUTH=true` in `.env` and send `Authorization: Dev <any-uid>`. This flag is refused at boot if `NODE_ENV=production`.

## Deploying (Render)

This service reuses an existing free Postgres instance shared with another app (see
`migrations/001_init.sql` — everything lives under a `current_quest` schema, not `public`) rather
than provisioning its own database. It runs migrations and seeds the star pack catalogue on every
deploy (both are idempotent), then starts the server. To deploy as a plain Web Service:

1. Push this `backend/` repo to GitHub.
2. In Render, "New +" → "Web Service" → point at the repo. Build command `npm ci && npm run build`, start command `npm run migrate && npm run seed && npm start`, health check path `/health`.
3. Set env vars: `NODE_ENV=production`, `DATABASE_URL` (the shared instance's Internal Database URL), `CORS_ORIGINS=*`, and optionally `GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64` once Play Billing exists client-side. No Firebase secret is needed — see below.
4. Deploy. Health checks hit `/health`.

(`render.yaml` documents this same config declaratively, for a Blueprint-based deploy instead.)

### Manual dashboard steps (outside this repo)

- **Firebase**: create/reuse a Firebase project and enable the sign-in method the Android app will use (Anonymous and/or Google). No service-account key is needed — `src/middleware/auth.ts` verifies ID tokens against Firebase's public signing keys, using only the (non-secret) project id hardcoded in `src/config.ts`.
- **Google Play Console** (defer until Play Billing is actually built into the app): create the in-app products for each star pack (product ids must match `star_packs.product_id` — edit `scripts/seed.ts` to match your actual product ids before seeding), then grant a service account (Setup → API access) "View financial data, orders" permission for purchase verification. Until `GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64` is set, `/purchases/verify` returns 503 rather than blocking the rest of the API.
- **Android client**: wire Firebase Auth into the app, send its ID token as `Authorization: Bearer <token>` on every request to this API, and call `/purchases/verify` after a successful Play Billing purchase flow.

## Scripts

- `npm run dev` — run with hot reload.
- `npm run build` / `npm start` — production build + run.
- `npm run typecheck` / `npm run lint` — CI checks.
- `npm run migrate:dev` / `npm run migrate` — apply `migrations/*.sql` (idempotent, safe to rerun).
- `npm run seed:dev` / `npm run seed` — upsert the star pack catalogue.
