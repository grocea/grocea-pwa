# T03 — Atomic bulk pantry updates

Implemented and locally verified on 2026-10-16 in the paired `03-bulk` worktrees. Root review found no remaining blocker. Root owns final staging/commit/push and canonical plan/status updates. No deployment or remote database write occurred.

## Delivered behavior

- `/pantry/bulk` provides searchable multi-selection, individual Add purchased amount / Set total on hand, compatible metric/count units, optional whole pack count, accessible row removal, retained drafts on validation/back navigation, and before/change/after review.
- `2 × 0.5 kg` produces exactly `1000.000 g` server-side and `1 kg` in the exact preview. Pack products use bigint/Decimal, never floating-point arithmetic or rounding; fractional count amounts remain supported. Zero stock displays `0 g` / `0 ml`.
- `POST /api/pantry-stocks/bulk` validates every row before writes, rejects duplicates, incompatible units, unsupported precision/range, foreign/archived/missing ingredients, empty/oversize batches and invalid pack counts. All rows commit under one account lock, revision, idempotency key and immutable manual activity event. A revision header is required. Invalid or stale batches create no stock/history/revision changes.
- One IndexedDB transaction saves the complete optimistic state and one `stock.bulk` outbox record. Entity validation, created-event dependency detection and row ingredient-ID remapping include the batch. Existing queue ordering and revision snapshot handling remain intact. Server conflicts retain one actionable sync issue.
- Empty/zero-stock Pantry points to setup, while existing single-item adjustment remains available. Empty Pantry omits the redundant ready-count pulse. Nonempty mobile pulse and actions fit compactly. Desktop sidebar wordmark uses dark green; hidden stock projection announcement stays 1px wide, including at768px.
- Bulk manual history retains existing reversal policy (manual events are not reversible); existing cooking/reversal still restores stock.

## Confirmed offline blocker fixed

The first genuine production offline reload exposed an existing `loadState()` bug: authenticated UUID catalogs were reconciled with bundled demo fixtures. An injected global oats fixture referenced its bundled custom breakfast category, absent from the server snapshot. The result failed validation as “Stored Grocea data is corrupt or incompatible.” Online reload hid the defect through server recovery.

Account-owned snapshots now clone the normalized persisted catalog instead of merging bundled fixtures. The first-sync mutation gate remains unchanged. Non-owner legacy databases retain fixture reconciliation and legacy shape normalization. Development demo storage also passes an owner ID, so it now preserves its own normalized seeded snapshot; demo reload was not separately tested in this production suite. T01 should retain the authenticated offline regression oracle.

The final browser oracle compares categories, ingredients, balances, activity and tracked IDs before/after offline reload, requires all authenticated ingredient IDs to remain UUIDs, and checks that the outbox ID and all three row payloads remain unchanged. All four widths passed.

## Runtime and actual commands

Backend working directory: `/Users/ammar/Documents/Grocea/.worktrees/03-bulk/grocea-backend`.
PWA working directory: `/Users/ammar/Documents/Grocea/.worktrees/03-bulk/grocea-pwa`.
Disposable local DB: `postgresql+psycopg://127.0.0.1:5432/grocea_next_phase_20261016`, `APP_ENV=local`. No migration was needed.

| Actual command | Result |
|---|---|
| `PYTHONPATH=src DATABASE_URL=postgresql+psycopg://127.0.0.1:5432/grocea_next_phase_20261016 APP_ENV=local /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m grocea.cli export-openapi` | PASS; worktree OpenAPI regenerated. |
| `npm run api:generate` | PASS; paired backend contract consumed deterministically. |
| `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/ruff check src tools/verify_bulk_stock.py` | PASS. |
| `PYTHONPATH=src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/mypy src` | PASS; 22 source files. |
| `npm run build` | PASS; latest production build includes persistence and compact pulse fixes. Existing >500kB chunk advisory remains. |
| `npx eslint src/features/pantry/BulkStockScreen.tsx src/features/pantry/screens.tsx src/app/GroceaProvider.tsx src/app/grocea-context.ts src/app/persistence.ts src/api/client.ts src/domain/types.ts src/shared/lib/quantity.ts src/app/App.tsx` | PASS. |
| `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python tools/verify_bulk_stock.py --base-url http://127.0.0.1:8000` | PASS; three-row exact Add/Set, pack arithmetic, one revision/event, replay, all-row rollback, duplicate/empty/oversize/precision/range/pack negatives, foreign ingredient/event ownership, stale/missing revision, sub-minor pack size with exact final product, resulting-balance overflow, unchanged cooking/manual reversal policy. |
| `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python tools/verify_shopping.py --base-url http://127.0.0.1:8000` | PASS; existing T02 standalone/manual and recipe shopping, replay, isolation, stale revision, duplicates, exact quantities, unknown amount, completion and preserved Basket. |
| `node tools/verify-mutation-queue.mjs` | PASS; tied/reversed creation ordering, acknowledged dependencies, failed-parent order, cycles/downstream blocking. |
| `python3 tools/serve-local-build.py --port 5184` | Running session32882, bound only to127.0.0.1, fixed proxy only to127.0.0.1:8000. Host/path traversal rejected; API redirects rejected; no URL/cookie/token logs. Leave running until root switches worktree. |
| `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m py_compile tools/serve-local-build.py` | PASS. |
| `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-bulk-browser.mjs` | PASS, exit0; production build + actual service worker at390/768/1440/320px. Both page and SW targets disconnected for real offline reload. |
| `node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/check_state_coverage.ts --root . --out reports/next-phase/task-03-state-coverage.json` | PASS lexical markers across40 source files; this is source evidence only. |
| `node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/visual_smoke_test.mjs --url http://127.0.0.1:5184 --out reports/next-phase/task-03-smoke` | HTTP200/nonempty HTML; helper screenshots skipped-no-browser-driver. Real screenshots came from the CDP suite. |
| `python3 -` with `http.client` GET assertions for `/%2e%2e/README.md`, foreign Host and `/pantry/bulk` | PASS;400/400/200 respectively. |
| `node --check tools/verify-bulk-browser.mjs` | PASS. |
| `git diff --check` in both worktrees | PASS. |

All network/API/browser commands used loopback only and generated disposable synthetic accounts. Shell network checks required the sandbox escalation mechanism. No secrets, credentials or session cookies are written to reports.

## Browser evidence and observed results

Machine-readable evidence: `reports/next-phase/task-03-browser/results.json`.

- All390/768/1440/320px runs: production service-worker controller present; actual Inter400/700 faces loaded; selected checkbox and removal activated with keyboard; invalid pack count focused the row without enqueueing; back from review retained values; offline save persisted one mutation and one three-change event; offline reload preserved account catalogs, stock, history, tracking and all queued rows; reconnect drained the queue and server contained exactly one event with1000g/375ml/1.5items.
- Document and nested `.app-page` widths stayed within their viewport/client widths. Nonempty compact pulse also passed its own scrollWidth/action-edge check. Desktop wordmark computed `rgb(25,59,43)`. Single-item hidden announcement measured exactly1px at every viewport.
- At768px, archiving a selected ingredient during review produced an unavailable-row fallback and disabled save. Returning to editing preserved the other row. Removing the unavailable row restored the workflow. A subsequent concurrent server write made the Set fail with `STATE_REVISION_CONFLICT`; server stock stayed1001g, no bulk event was added, and Sync issues displayed “Account changed elsewhere.”
- Zero runtime JavaScript exceptions in final suite. No test mocks or production OCR claim.

Useful final screenshots:

- `task-03-browser/pantry-390.jpg` — empty Pantry/setup and compact actions.
- `task-03-browser/offline-reload-320.jpg` — durable offline stock, compact nonempty pulse, narrow screen.
- `task-03-browser/editor-1440.jpg` — searchable selection/editor and corrected desktop wordmark.
- `task-03-browser/review-390.jpg`, `review-768.jpg` — exact review, focus and save count.
- `task-03-browser/unavailable-review-768.jpg`, `stale-conflict-768.jpg` — unavailable selected ingredient and visible revision conflict.
- `task-03-browser/single-768.jpg` — preserved single-item form and hidden-content sizing repair.

Implementer inspected the final pantry390, offline320, review390, editor1440 and unavailable768 images. Root independently reviewed review/pantry and final tablet/narrow screenshots. At320px the existing Needs-restock segment/count remains dense; root assigns that copy/layout adjustment to T05. The final workflow has no unintended horizontal document/page/pulse overflow.

## Corrections during verification

Initial checks found a generated-contract `unknown` event-ID typing mismatch and Ruff line lengths; fixed and reran successfully. The API script initially used `event_type` instead of existing response `type`, and expected201 for existing cook/reverse endpoints that correctly return200; assertions corrected to actual documented contract. CDP native Enter activation required text in the keyboard event; a lowercase conflict-text assertion was corrected to the actual visible heading. Applying offline conditions only to the page allowed SW requests through; final checks disconnect both targets. The true offline cache corruption and compact pulse clipping were application defects and were fixed as described above. Intermediate failure screenshots/JSON are diagnostic artifacts, not final passing evidence.

## Changed application and tooling files

Backend: `src/grocea/schemas.py`, `src/grocea/full_services.py`, `src/grocea/api.py`, `openapi/openapi.json`, `tools/verify_bulk_stock.py`.

PWA: `src/features/pantry/BulkStockScreen.tsx`, `src/features/pantry/screens.tsx`, `src/app/App.tsx`, `src/app/GroceaProvider.tsx`, `src/app/grocea-context.ts`, `src/app/persistence.ts`, `src/domain/types.ts`, `src/api/client.ts`, `src/api/generated.ts`, `src/shared/lib/quantity.ts`, `src/styles/app.css`, `tools/verify-bulk-browser.mjs`, `tools/serve-local-build.py`.

Evidence: this report, browser results/screenshots, state-coverage JSON and smoke JSON. Reports are ignored by the repository default; root should force-add the selected final evidence only. Existing plan/status changes in the worktree were parent-owned; implementer did not alter canonical plan status.

## Explicit limits

No physical installed-iOS/Android, non-Chromium, external release, remote API or actual participant checks were performed. Development demo reload is not separately verified. No production OCR, SMTP, external messaging, deployment, remote migration, pytest or Vitest was added or run. Unsaved form drafts survive validation and review/back navigation, while only saved batches are promised durable across reload. Root owns commit/push and subsequent T05/T01 integration.
