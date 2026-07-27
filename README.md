# Grocea PWA

Offline-first React PWA for Grocea. FastAPI backend is authoritative; IndexedDB
stores canonical server snapshot, optimistic local state, mutation outbox, stable
device/import IDs, and synchronization issues.

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

## Synchronization

Writes update UI immediately and enter IndexedDB outbox atomically. Sync runs on
startup, reconnect, focus, and local writes. Network and server failures retry
with bounded backoff; rejected mutations remain visible on Synchronization
screen for retry or discard.

Existing IndexedDB state uploads once. Backend maps legacy global fixture IDs,
safe-merges compatible custom data, preserves exact balances/history, and
reports conflicts without overwriting existing server data.
