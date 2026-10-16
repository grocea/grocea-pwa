# T04 — account recovery, export and deletion

Local implementation and verification complete on paired `codex/grocea-04-account` worktrees, based on verified T05 (backend54a5a63 / PWAe1227d7). Root owns final review, staging, commits and push. No deployment, remote database mutation, external email, real-account deletion or participant contact occurred.

## Delivered

- Configurable standard SMTP recovery with trusted origin, fragment reset links, 32-byte random credentials stored only as SHA-256 hashes, expiring single-use reset and all-session/all-reset-link revocation. Reset requires normal sign-in and attempts an actual password-change notification after commit.
- Same generic 202 for known/unknown/address-throttled requests, common 150ms minimum response floor and post-response SMTP work; universal 503 for missing/invalid configuration. PostgreSQL atomic throttle buckets survive processes/restarts, include address cooldown/IP/confirmation limits and prune expired rows in bounded batches. SMTP uses validating TLS outside local/test, finite socket timeouts and redacted warnings.
- Shared User lock/refetch and post-lock session/CSRF revalidation before authenticated reads/writes/replay; login verifies the current hash after locking. Password change invalidates reset links. Optional X-Account-ID fences client/account cookie mismatches and is CORS-allowed. Malformed non-ASCII session/reset credentials fail authentication rather than raising ASCII errors.
- Version 1 allowlisted JSON export includes archived personal records, pantry thresholds/refills, exact decimal strings, draft input, stock/reversal history, basket, completed/active grocery lists and source/original snapshots, and shared catalog context. It excludes all authentication/recovery/throttle/replay secrets and explicitly disclaims restore support.
- Transactional current-password/CSRF/literal-confirmation deletion with ownership preflight, dependency-safe teardown and handling for imported reversal cycles. Global records/other accounts are preserved; inconsistent surviving cross-account references block the whole operation.
- Public recovery UI stable across auth bootstrap/lock, URL fragment removed immediately, no stored bearer tokens, explicit pending-work export exclusion, deletion cancellation/error/success and adjacent focused current-password feedback.
- Account-scoped persistent pause/deletion markers, delayed response-body generation fences, account-switch boundaries, cross-tab invalidation using each tab's own account identity, blocked-IDB cleanup/reload recovery, and account-only IndexedDB/outbox/canonical/auth/legacy/trial cleanup. Trial keys are `grocea:trial:<userId>` and colon descendants, using exported `TRIAL_STORAGE_PREFIX` / `clearTrialStorage`.

SMTP delivery tasks are real but process-local, not a durable queue. Acceptance does not promise inbox delivery; process interruption may require another request. SMTP timeout is per blocking operation, not a global DNS/network deadline. Production credentials/sender authorization/task lifetime/inbox delivery remain release configuration. Other devices can retain local copies: sign out or clear their Grocea site data. Reconnect rejects revoked sessions but does not remotely erase storage/downloaded files.

## Commands actually run

Backend commands used `/Users/ammar/Documents/Grocea/grocea-backend/.venv/bin/python` (or sibling Ruff/mypy binaries) with `PYTHONPATH=04-account/grocea-backend/src`. Every database/network verification used the explicitly authorized `postgresql+psycopg://127.0.0.1:5432/grocea_next_phase_20261016` and loopback services. Local network shell commands ran with sandbox escalation; initial non-escalated migration was denied by the filesystem/network sandbox and the authorized loopback retry passed.

| Command | Result |
| --- | --- |
| `APP_ENV=local DATABASE_URL=... PYTHONPATH=src python -m grocea.cli migrate` | Passed 0005→0006 on isolated fixture DB. |
| `.venv/bin/ruff check src` | Passed final source. |
| `.venv/bin/mypy src` | Passed all 24 source files. |
| `APP_ENV=local PYTHONPATH=src python -m grocea.cli export-openapi` | Passed; generated contract updated. |
| `npm run api:generate` | Passed; PWA types regenerated from paired backend. |
| `npm run build` | Passed final TypeScript/production build; existing >500kB chunk warning remains. |
| `npx eslint` on changed API/app/auth/account/persistence/provider/settings files | Passed. |
| `APP_ENV=local DATABASE_URL=... PYTHONPATH=src python tools/verify_account.py --serve` | Passed final real PostgreSQL/API/SMTP suite; retained private local browser fixture until shutdown. |
| Same environment, `python tools/verify_account_config.py` | Passed universal HTTP503/no-store missing-config scenario; temporary 8001 API stopped in finally. |
| `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-account-browser.mjs` | Passed 7 grouped checks, including stronger final two-tab sign-in-form assertion. |
| Same CDP module, `node tools/verify-account-fencing.mjs` | Passed 3 grouped checks on final account/connection fences. |
| Same CDP module, `node tools/verify-account-export.mjs` | Passed 4 grouped pending-export/visible-control checks. |
| Same CDP module, `node tools/verify-account-feedback.mjs` | Passed focused 320px reauthentication error/focus/session check and final phone capture. |
| `node .../webapp-ui-skill/scripts/check_state_coverage.ts --root . --out reports/next-phase/task-04-state-coverage.json` | All markers found; lexical evidence only. |
| `node .../webapp-ui-skill/scripts/visual_smoke_test.mjs --url http://127.0.0.1:5184/forgot-password --out reports/next-phase/task-04-smoke` | HTTP200/nonempty HTML; real browser evidence is supplied separately. |

Verification fixture servers were `python tools/serve-local-build.py --port 5184` after a real production build, development-only `npm run dev:demo -- --host 127.0.0.1 --port 5185`, and `verify_account.py --serve` owning API 8000/SMTP 8025/private fixture control 8030. No symlinked node_modules or test frameworks were introduced.

## Executed oracles

API suite: malformed/missing trusted-origin configuration; actual stalled SMTP timeout and redacted failure; identical known/unknown public request response and minimum timing floor; real reset mail and hashed storage; concurrent same-token use exactly one 204/one 400; expiry/replay/Unicode failures; both old sessions revoked and old password rejected; new password ordinary login; persistent cooldown and indexed expiry cleanup; archive-inclusive exact export and absence of secrets/other account; wrong-password deletion retains valid session; wrong confirmation rejected; surviving foreign reference prevents any deletion; full deletion including archived rows, replay/session/reset data, source snapshots and imported reversal cycle; B/global preservation; blocked old-session export/new write/cached replay rejects after revocation without advancing revision; login refreshes a hash replaced while waiting; allowed-origin X-Account-ID preflight.

Browser suite: anonymous/authenticated reset token survives bootstrap and success survives lock; fragment removed; ordinary login;320/390/768/1440 controls/no document overflow; cancellation; wrong password stays in the form with a valid session; two-tab successful deletion clears account database/outbox/trial/auth and preserves another trial key, with both tabs actually reaching sign-in. Reload stays locked. A held `response.json()` export body released after A→B activation causes no stale download. Intentionally blocked raw IndexedDB connection surfaces cleanup recovery; reload closes it and resumes persistent purge. Existing development demo loads/reloads without auth network calls.

Pending export used a real offline profile edit with **both page and existing service-worker CDP sessions offline**, then a targeted mutation-endpoint outage while export became available. A second-device server profile edit remained newer. Export showed the exclusion warning and performed no server export until explicit “Export server data only”; resulting snapshot excluded the pending local value, retained the server value and included an archived ingredient. This targeted outage is not mislabeled as complete offline operation after reconnect.

Visual review inspected actual phone/desktop images of recovery, the new data controls, confirmation, error and pending-export warning. Long synthetic email wraps and avatar remains full width. Final wrong-password error is beside the focused deletion password field and visible on phone. Material focused evidence:

- `task-04-browser/recovery-320.jpg`
- `task-04-browser/data-controls-visible-320.jpg`, `...-390.jpg`, `...-1440.jpg`
- `task-04-browser/delete-confirm-320.jpg`, `...-390.jpg`, `...-1440.jpg`
- `task-04-browser/delete-error-focused-320.jpg` (final adjacent-error/focus correction; earlier delete-error captures show the superseded error placement)
- `task-04-browser/profile-header-320.jpg`
- `task-04-browser/export-pending-390.jpg`
- Redacted `results.json`, `fencing-results.json`, `export-results.json`, `feedback-results.json`.

## Corrections during verification

Initial test harness assertions assumed first recipe row was owned rather than global, reused an already consumed mail token while new delivery was pending, submitted an unsupported profile field, expected a login form despite a shared valid browser cookie, and matched CSS-transformed label text. These harness assertions were corrected and rerun. Repeated harness runs also reached the persisted fixture IP throttle as designed; repeat setup now resets only the fixture secret's loopback IP bucket. Offline reconnection restores the **same** worker CDP sessions, avoiding an old offline override. No test failure is represented as a passing product check.

Implementation review corrected recovery remount/token loss, known-password401 being mistaken for session expiry, account-switch/body continuation fencing, cross-tab identity lookup after shared cache removal, demo account guard initialization, malformed config handling, bounded throttle retention, CORS header allowance, narrow-profile email/avatar layout, and phone deletion-feedback position/focus. Static errors in the first draft were resolved before final checks.

## Scope/remaining checks

Executed local fixtures are not real-user outcomes or physical-device tests. Physical installed iOS/Android, real production SMTP/TLS-provider behavior/task lifetime, deployment/remote verification and a consenting one-week trial remain external. The study's additional adversarial cases such as multi-process throttle load, DNS overall deadline, cross-tab offline sign-out with a held bootstrap, and lost DELETE response ambiguity were reviewed in implementation but not all separately executed. No claim of exhaustive completion of every ACCOUNT-STUDY oracle is made.

Skill used: webapp-ui. Its two shared privacy/visual reference paths are absent in this installation; existing repository privacy constraints and the stronger synthetic authenticated CDP workflow were used. Generic marker/HTML checks are not substituted for browser evidence.

Only paired 04-account application worktrees were edited. Canonical task statuses were left to root. Root should force-add intended ignored reports if desired; no staging, commit or push was performed by this implementer.


## Final shutdown

Final focused feedback/build/lint check passed after code freeze. The harness, its API/SMTP/control children, production fixture and development demo were stopped. A socket check confirmed all task ports closed:8000,8001,8025,8030,5184,5185. No task server remains running. The shared isolated fixture database remains available at migration0006; no database was dropped. No application edits followed the final focused UI verification.
