# T02 — standalone shopping and restock-to-list evidence

Implemented and locally verified on 2026-10-16. Root review/commit/plan-status ownership remains with the parent agent.

## Delivered behavior

- `POST /api/grocery-lists` accepts `ManualGroceryListCreate` (`id`, optional title defaulting to `Shopping list`). It creates an empty **active** account-owned list using the existing account lock, idempotency replay and state-revision guard. No migration is needed; the existing one-active-list partial unique index remains authoritative.
- Recipe generation stays at `/api/grocery-lists/from-basket`. Standalone creation and restock additions preserve Basket.
- Groceries offers **Start shopping list**. Manual-only active and completed lists hide source-recipe disclosure, return-to-Basket and reuse controls, and show truthful item-focused empty/history copy.
- Pantry Needs restock rows open a compact ingredient-specific shopping editor. Quantity is optional; known amounts use the ingredient's metric units and exact canonical bigint/Decimal quantities. The action creates a list if needed.
- Restock detects existing ingredient-linked items locally and shows **Already on your shopping list** with an Open list action. Restock mutation payloads also set `prevent_duplicate_ingredient`, which returns `GROCERY_INGREDIENT_ALREADY_LISTED` for duplicate server submissions. Ordinary manual-list item behavior remains available.
- List/item queue dependencies are derived from creator IDs, including `grocery-list.manual.create`. `mutationQueue.ts` orders persisted changes by dependencies rather than timestamp/UUID order. An absent dependency represents an already acknowledged/removed mutation; failed parents block dependents; cycles and their downstream changes become explicit failed sync issues. Revision conflicts remain explicit and stop dependent work; no revision checks are bypassed.
- Each acknowledged revision is saved before the next mutation. Writes arriving during an in-flight snapshot schedule another sync pass, avoiding an ignored-event stall or stale cursor.
- Complete list is hidden while the item editor is open, leaving Save/Cancel as the draft's actions. Existing checked-item Pantry preview and completion remain intact.

## Actual commands and results

All application work used paired worktrees under `/Users/ammar/Documents/Grocea/.worktrees/02-shopping/`. The parent started the API with explicit loopback database `postgresql+psycopg://127.0.0.1:5432/grocea_next_phase_20261016`; API port 8000 and PWA port 5184. Tests created generated disposable accounts only, with no production data, remote database changes or external messages.

Backend commands, run from `grocea-backend`:

```sh
PYTHONPATH=/Users/ammar/Documents/Grocea/.worktrees/02-shopping/grocea-backend/src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m grocea.cli export-openapi
PYTHONPATH=/Users/ammar/Documents/Grocea/.worktrees/02-shopping/grocea-backend/src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m ruff check src
PYTHONPATH=/Users/ammar/Documents/Grocea/.worktrees/02-shopping/grocea-backend/src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m mypy src
PYTHONPATH=/Users/ammar/Documents/Grocea/.worktrees/02-shopping/grocea-backend/src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m ruff check tools/verify_shopping.py
python3 tools/verify_shopping.py --base-url http://127.0.0.1:8000
```

Results: OpenAPI exported; Ruff passed; mypy reported `Success: no issues found in 22 source files`; standard-library API scenario passed manual creation, one-active constraint, idempotent create/item replay, account isolation (read/update), stale revision, exact metric conversion, restock duplicate guard, unknown quantity, invalid/missing quantity/unit validation, completion-to-Pantry, Basket preservation and existing recipe generation. `tools/verify_shopping.py` rejects non-loopback origins and redirects and writes no credentials. These Python module invocations used the existing environment with explicit worktree `PYTHONPATH`, instead of claiming that planned `uv run` commands ran.

PWA commands, run from `grocea-pwa`:

```sh
npm run api:generate
npm run build
npx eslint src/app/App.tsx src/app/GroceaProvider.tsx src/app/grocea-context.ts src/app/mutationQueue.ts src/api/client.ts src/features/groceries/GroceryScreens.tsx src/features/pantry/screens.tsx tools/verify-mutation-queue.mjs tools/verify-shopping-browser.mjs
node tools/verify-mutation-queue.mjs
node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/check_state_coverage.ts --root /Users/ammar/Documents/Grocea/.worktrees/02-shopping/grocea-pwa --out reports/next-phase/task-02-state-coverage.json
GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-shopping-browser.mjs
git diff --check
git -C ../grocea-backend diff --check
```

Results: generated contract, production build, focused ESLint, queue assertions and both whitespace checks passed. Vite retained the nonfatal >500 kB bundle warning (final JS approximately 550.13 kB). The state-marker scan passed across 39 files; this is lexical coverage, not proof of runtime state behavior.

`tools/verify-mutation-queue.mjs` uses the project's existing TypeScript dependency to execute the actual ordering module. It checks tied/reversed order, acknowledged dependencies, failed-parent ordering, a dependency cycle, and downstream blocking. It adds no test framework.

`tools/verify-shopping-browser.mjs` uses a locally installed Chrome/Chromium plus the existing local CDP Browser helper. Set `GROCEA_CDP_MODULE` to the helper path above; `GROCEA_UI_ORIGIN` defaults to loopback port 5184. The helper is a verification dependency and is not bundled into the application.

## Browser/runtime evidence

Authenticated headless Chromium, real local API, synthetic accounts and durable account-scoped IndexedDB were used at **390×844, 1280×900 and 320×844**.

All widths passed:

- empty Groceries and standalone/manual list creation;
- actual Pantry Needs restock row navigation, optional editor and exact `1.25 kg → 1250.000 g` persistence;
- custom unknown-quantity item;
- recipe-only controls absent for manual lists;
- sticky Complete absent during draft editing;
- duplicate feedback without another queued mutation;
- offline list and items persisted with dependencies;
- an intentionally tied timestamp and a parent UUID sorting after its children, followed by successful reconnect synchronization;
- exactly one active list, two items, no recipe sources and unchanged recipe Basket;
- checked-item completion preview and exact Pantry update;
- rendered main content, no final-hub horizontal overflow, no runtime exceptions.

390px also passed a simulated second-device revision change: the list creation remained a visible `Account changed elsewhere` sync issue, its dependent item was blocked, and the server had no new active list.

1280px also passed a real in-flight race: CDP held the manual-list creation response, an item was saved during that snapshot, and releasing the response automatically synchronized the next snapshot with the saved revision. No retry button or revision bypass was required.

Evidence: `reports/next-phase/task-02-browser/results.json` and synthetic JPEGs for empty, restock rows/editor, shopping, custom editor, duplicate feedback, completion, and stale conflict. Representative captures were visually inspected locally; no real-account screenshots were taken.

Early verification iterations exposed and corrected harness issues (API error shape, CDP bigint serialization, waiting for persisted checkbox state, choosing the current account's IndexedDB, isolating a second-device fixture from app auto-sync, and matching the existing conflict message). An initial Ruff line-length error was corrected. The final all-width browser run passed. These iterations are not represented as successful runs.

## State coverage and limits

Ran: build, focused lint/types, generated contract, standard-library API integration, dependency-order assertions, lexical state scan, authenticated Chromium offline/reconnect and screenshots.

Skipped: generic unauthenticated visual-smoke script, because the task-specific authenticated script exercised the actual flows and saved evidence; pytest/Vitest were intentionally not introduced; deployment and physical-device checks did not run.

Manual: native dialog Cancel focus styling was visible in captures. Full screen-reader/keyboard traversal, touch hardware, installed iOS/Android behavior, production service-worker offline relaunch/cache update, and deployed API verification remain outside this local T02 evidence. Browser network emulation is not a claim of installed-PWA or physical-device coverage.

## Changed files and next handoff

Backend: `src/grocea/api.py`, `src/grocea/full_services.py`, `src/grocea/schemas.py`, `openapi/openapi.json`, `tools/verify_shopping.py`.

PWA: `src/api/client.ts`, `src/api/generated.ts`, `src/app/App.tsx`, `src/app/GroceaProvider.tsx`, `src/app/grocea-context.ts`, new `src/app/mutationQueue.ts`, `src/features/groceries/GroceryScreens.tsx`, `src/features/pantry/screens.tsx`, `src/styles/app.css`, `tools/verify-mutation-queue.mjs`, `tools/verify-shopping-browser.mjs`, this report and verification artifacts.

For T03/T04 and final T01 verification: reuse the queue module and the existing mutation/revision/idempotency contract. New multi-step operations must declare creator/reference dependencies and preserve account-scoped storage. Manual-list creation needs no schema migration. The API and browser scripts are rerunnable with fresh generated accounts against loopback only. Preserve unrelated original `.gitignore` and marketing edits; no application changes were made in the original working trees. Root owns final plan/STATUS consolidation, commits and pushes.
