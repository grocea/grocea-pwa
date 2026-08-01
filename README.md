# Grocea PWA

Offline-first React PWA for Grocea. Personal accounts are established by the
FastAPI backend; the browser receives only a host-only HttpOnly session cookie
and keeps the CSRF token in memory. IndexedDB stores canonical server snapshots,
optimistic local state, mutation outboxes, stable device/import IDs, and
synchronization issues inside `grocea:<account-id>` databases.

## Setup

Start `grocea-backend` on `127.0.0.1:8000`, then:

```bash
npm install
npm run api:generate
npm run dev
```

Vite proxies `/api` to local backend. For another origin, copy `.env.example`
and set `VITE_API_ORIGIN`.

## Checks

```bash
npm run api:generate
npm test
npm run build
npm run lint
```

`src/api/generated.ts` is generated from
`../grocea-backend/openapi/openapi.json`. Commit backend OpenAPI and regenerated
frontend types together.

Authentication routes are `/welcome`, `/login`, and `/register`; every product
route requires a confirmed session. A new account fetches `/api/state` before
rendering product data. If an old unowned `grocea` database is found, Grocea
offers a one-time move or confirmed delete decision before opening the account
database. Session expiry preserves pending mutations and returns to sign-in.

## Synchronization

Writes update UI immediately and enter IndexedDB outbox atomically. Sync runs on
startup, reconnect, focus, and local writes. Network and server failures retry
with bounded backoff; rejected mutations remain visible on Synchronization
screen for retry or discard.

Migrated local state uploads once. Backend maps legacy global fixture IDs,
safe-merges compatible custom data, preserves exact balances/history, and
reports conflicts without overwriting existing server data. The service worker
keeps `/api/*` network-only and the app-shell cache is versioned for auth rollout.
