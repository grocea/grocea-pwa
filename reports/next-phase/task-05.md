# T05 — Optional pantry restock preferences

Implemented and verified locally on 2026-10-16 in paired `codex/grocea-05-restock` worktrees. No deployment, remote database writes, real-account mutations, commits or pushes were performed by this implementer.

## Behavior

- Each tracked pantry row has nullable canonical `low_stock_threshold` and `refill_quantity`. Null threshold keeps depleted-only behavior. Restock includes balance <= threshold; positive balances are explicitly Running low, zero is Empty, negative is Below zero. Header counts partition tracked ingredients into depleted, running low and remaining stock implicitly; the In stock tab still includes positive running-low ingredients and explanatory copy makes that overlap explicit.
- Refill is a fixed amount to buy, independent of threshold/balance. Exact positive values prefill the editable shopping editor. Null or zero refill leaves the shopping amount blank; settings copy explains this. Compatible metric/count unit menus use exact conversion and reject unrepresentable fractions/range overflow.
- Revisioned, idempotent, account-scoped preferences PUT; family/range/nonnegative validation. Add/Set/bulk/Cook/shopping completion retain preferences. Untrack removes them deliberately. Preferences do not create or rewrite stock history.
- State mapping, durable account storage, legacy normalization, import serialization/remapping and queued mutation entity validation include preferences. Conservative imports retain differing server preferences and report conflicts.
- Archived tracked rows retain server preferences for restore/export. Client visible preference maps omit archived/nonvisible rows so they cannot invalidate cached state. Archived preference writes are rejected until restored.
- Settings and restock prefill follow freshly synced preferences until the user edits a field; edited drafts remain intact. Settings are reachable from stock adjustment and the restock shopping screen.
- Tab label/count layout fits 320px phones and the constrained tablet toolbar.

## Ran

All commands used the worktrees, with backend runtime `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python` and backend `PYTHONPATH=src` where applicable.

1. From backend worktree: `DATABASE_URL=postgresql+psycopg://127.0.0.1:5432/grocea_next_phase_20261016 APP_ENV=local PYTHONPATH=src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m grocea.cli migrate` — passed, applied `20260801_0004 -> 20261016_0005` to the dedicated local fixture DB only. Initial attempts from the parent directory and without loopback network permission failed without changing the DB; correct working directory and permitted loopback execution resolved them.
2. `PYTHONPATH=src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python -m grocea.cli export-openapi` and PWA `npm run api:generate` — passed; committed contract and generated client updated.
3. Backend `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/ruff check src` and `PYTHONPATH=src /Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/mypy src` — passed; 22 source files have no mypy issues.
4. Backend `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python tools/verify_restock.py --base-url http://127.0.0.1:8000` — passed with disposable synthetic accounts. Covered default nulls, exact values,501/500/499.999/0/negative boundaries, negative/precision/range/family/NaN rejection without state changes, replay and revision conflict, other-account/private-ingredient ownership, bulk/manual/cooking/shopping completion retention, untrack/retrack reset, legacy ID mapping, preference import conflicts, archived writes and archive/restore retention.
5. PWA `npm run build` — passed. Existing >500kB JavaScript chunk warning remains; no build failure.
6. PWA `npx eslint src/app/GroceaProvider.tsx src/app/persistence.ts src/app/grocea-context.ts src/api/client.ts src/domain/types.ts src/features/pantry/screens.tsx src/features/pantry/PreferencesScreen.tsx src/features/groceries/GroceryScreens.tsx src/app/App.tsx` — passed.
7. PWA `node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/check_state_coverage.ts --root . --out reports/next-phase/task-05-state-coverage.json` — passed lexical markers. This scan is supplementary, not runtime proof.
8. PWA production fixture `python3 tools/serve-local-build.py --port 5184`, then `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-restock-browser.mjs` — passed at390/768/1440/320px using generated local accounts. Real production service-worker control, page AND worker network offline, durable settings save/reload with unchanged mutation ID/payload, reconnect drain, exact fixed refill and user override, fresh-page settings, positive-low copy,501 boundary, clearing settings, overflow and keyboard checkbox checks. At390px also checked archive→state→true offline reload→restore, zero refill blank prefill, and legacy IndexedDB state without preferences on true offline reload. Fresh accounts retained zero-only defaults across the viewport runs.
9. `git diff --check` — passed in both repositories.

Browser checks initially exposed a tablet count overflow and stale cached prefill after another-device changes; both were corrected before the final passing run. The parent review identified the archive cache invariant, fixed and covered in API/browser checks. A temporary setState-in-effect approach failed targeted ESLint and was replaced with derived untouched-field values; final targeted lint passes.

## Evidence

- [Browser results](task-05-browser/results.json)
- [320px positive-low restock/count layout](task-05-browser/restock-320.jpg)
- [390px settings and validation state](task-05-browser/settings-390.jpg)
- [Tablet exact refill prefill](task-05-browser/prefill-768.jpg)
- [Desktop settings and validation state](task-05-browser/settings-1440.jpg)
- [State marker scan](task-05-state-coverage.json)

Selected screenshots were visually inspected; green Kitchen Ledger identity, labels, spacing and controls remain readable. Settings captures intentionally include the negative-value validation message from the exercised error state.

## Skipped / manual / rollback

No pytest/Vitest reinstalls or runs. Generic skill visual-smoke wrapper skipped because the task-specific real Chromium suite covers authenticated settings, shopping and durable offline runtime. The skill's referenced shared privacy/visual-verification files were absent at its resolved paths; verification used loopback synthetic content only. Physical installed devices, screen readers and other browser engines remain manual. No remote release or actual participant checks are claimed.

Migration downgrade discards only the two preference columns and their constraints; stock/history remain. Downgrade was not executed. Roll back API/client contract together if reverting. Root owns final review, plan/wiki reconciliation and authorized commits/pushes.

Local fixture server PID66256 (exec session86016) is stopped at handoff; the root-owned API8000 remains under root control.
