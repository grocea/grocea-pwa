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

Vite proxies `/api` to local backend. For local development against another
origin, set `VITE_API_ORIGIN`.

Cloudflare Workers deployment serves the PWA and proxies `/api/*` to the
production backend from the same origin. Production builds always use relative
`/api` requests, even if a stale `VITE_API_ORIGIN` value remains configured.
Leave that variable empty or unset in Cloudflare. Deploy with:

```bash
npm run deploy
```

## UI development without an API

```bash
npm install
npm run dev:demo
```

This development-only mode opens a sample kitchen immediately, with pantry stock,
recipes (including a draft), a basket, grocery lists, and activity. Product
interactions use the normal local state and IndexedDB persistence without API
requests or a synchronization outbox. Changes survive reloads; **Reset demo data**
restores the sample kitchen.

Demo storage uses `grocea:development-demo:v1` and never imports legacy data or
uses real account/session storage. Sign out from Profile to work on login and
registration; both forms accept locally valid inputs and reopen the same demo
kitchen. Password changes are simulated. Reloading starts signed in again.
The `/welcome` and `/system-states` pages are also available.

Alternatively, set `VITE_DEMO_MODE=true` in `.env.local` and use `npm run dev`.
Remove that flag to return to API-backed development. Production builds ignore
this flag and always require real authentication. Demo mode does not verify
server validation, authentication security, or synchronization behavior.

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
keeps same-origin `/api/*` network-only and the app-shell cache is versioned for
auth rollouts. Cross-origin API requests are not handled by the service worker.


### Account recovery, export and deletion

Forgot-password and reset pages are public and work while signed in. Reset tokens stay in memory, are removed from the URL fragment immediately, and are never stored with offline data. SMTP must be configured on the backend; accepted requests do not promise mail delivery.

Profile provides version1 server JSON export and online current-password account deletion. Export waits for local writes and active sync; remaining queued/failed/import-conflicting work requires an explicit server-only exclusion choice. It does not promise restore support. Account deletion removes server records and this browser's account IndexedDB/outbox/canonical state, authentication markers, and trial journal across same-origin tabs. Other devices may retain local copies: sign out or clear Grocea site data on those devices. Reconnection rejects revoked sessions but does not remotely erase caches or downloaded exports.

Cleanup uses account-scoped pause/deletion markers and request/account generations. A blocked IndexedDB deletion shows a retry screen; reload resumes persistent cleanup. Account switching rejects delayed response-body continuations. Development demo storage remains isolated.

T06 trial storage contract: import `TRIAL_STORAGE_PREFIX` / `clearTrialStorage` from `src/app/account-lifecycle.ts`. Keys are exactly `grocea:trial:<userId>` or begin `grocea:trial:<userId>:`. Deletion clears only those keys for its account, preserving other accounts. No journal transmission is implied.

Repeatable local production browser checks (backend `tools/verify_account.py --serve`, build fixture5184, and development demo5185 must be running):

```sh
GROCEA_CDP_MODULE=/absolute/path/to/cdp.mjs node tools/verify-account-browser.mjs
GROCEA_CDP_MODULE=/absolute/path/to/cdp.mjs node tools/verify-account-fencing.mjs
GROCEA_CDP_MODULE=/absolute/path/to/cdp.mjs node tools/verify-account-export.mjs
```

These create only synthetic disposable accounts and use real local storage/service workers. Scripts keep credentials/reset links in memory and save redacted results/screenshots. They do not verify physical installed devices, production SMTP, deployment or remote cache erasure.
