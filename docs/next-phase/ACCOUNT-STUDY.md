# T04 account recovery and data controls — implementation study

Prepared 2026-10-16. Preparation only: source inspection of the paired `03-bulk` worktrees and original AGENTS/OpenWolf instructions; no application edits, database access, mail sends, runtime acceptance checks, commits or deployment. Recheck locations and schema against completed T05 before implementation. T05 adds pantry threshold/refill fields; T06 has not created its trial storage yet.

## Recommended contract

| Endpoint | Input and response | Required behavior |
| --- | --- | --- |
| `POST /api/auth/password-reset/request` | `{email}`; generic `202` message | Public; validate allowed Origin; account-independent configuration errors; shared-store throttling; never return a token or claim inbox delivery. |
| `POST /api/auth/password-reset/confirm` | `{token,new_password}`; `204` | Public bearer-token operation with allowed-Origin validation; same password policy as registration; atomic single use; revoke every account session and reset token; clear caller cookie; ordinary sign-in afterward. |
| `GET /api/account/export` | Versioned JSON attachment | Authenticated, `Cache-Control: no-store`; complete owned kitchen records including archives and historical snapshots; no auth secrets or mutation replay bodies. |
| `DELETE /api/account` | `{current_password,confirmation:"DELETE"}`; `204` | Authenticated + CSRF + online password reauthentication; same account lock as writes; one teardown transaction; clear cookie; client cleanup. |

Use semantic invalid-reset error `400 PASSWORD_RESET_INVALID` for malformed, missing, expired, consumed and revoked tokens; do not reveal which condition applied. Apply length/character validation before ASCII token hashing so malicious Unicode input cannot trigger `_token_hash(...encode("ascii"))` exceptions. Set reasonable body field maximum lengths. Existing 15–128-character password policy stays consistent. A UI repeat-password field is sufficient; do not log either value.

Reset routes must be added to `main.py:custom_openapi` public paths. Otherwise generated OpenAPI incorrectly attaches cookie security and a required CSRF header. The client has a separate login/register-only CSRF exemption; explicitly classify both reset endpoints as public too. Generate backend OpenAPI and PWA types after contract changes.

The reset screen must remain reachable while authenticated. `PublicAuthRoute` currently redirects authenticated users away from login/register; do not wrap recovery in that same redirect unmodified.

## Verified code paths and consequences

Paths below are relative to `.worktrees/03-bulk/grocea-backend` or `.worktrees/03-bulk/grocea-pwa` at inspection time; line positions may move during T03/T05.

| Source | Verified behavior | T04 implication |
| --- | --- | --- |
| Backend `src/grocea/auth.py:resolve_session`, `dependencies.py:get_current_auth` | Cookie hash lookup and CSRF check happen before service execution. | They do not establish a transaction-wide authorization boundary. |
| Backend `src/grocea/api.py:118–175`, `apply_mutation` | Locks User; looks up cached mutation; checks revision; operates and commits. It does not revalidate the resolved session after waiting. | A reset-revoked request can otherwise write or receive a cached replay after reset commits. |
| Backend `auth.py:authenticate`, `change_password` | Neither explicitly locks/refetches User. Password change removes sessions and issues a new one. | Old-password login/session issuance can race reset; password change can race deletion/reset. |
| Backend `models.py:ActivityEvent`, `StockChange` | Activity references recipes and another activity with restrictive FKs; changes restrict event/ingredient deletion. | Account teardown needs explicit ordering, not `delete(User)` alone. |
| Backend `full_services.py:1474–1478` | Legacy import assigns `reversal_of` between imported events without requiring cooking/reversal types or an acyclic graph. | A deletion algorithm based only on `event_type == "reversal"` is insufficient for imported data. |
| Backend `full_services.py:state_response`, `list_recipes` | Sync state excludes archived categories, ingredients and recipes. | Reusing the sync snapshot alone silently omits personal data. |
| Backend `models.py:ProcessedMutation` | Replay rows contain complete response JSON and have a restrictive account FK. | Delete these rows; exclude them from export. |
| PWA `auth-context.tsx` | Last account/unlock/logout markers live in localStorage; logout broadcasts an unscoped string; `lock` preserves last-account cache. | Deletion needs account-scoped persistent invalidation and explicit full auth-cache cleanup. |
| PWA `GroceaProvider.tsx:synchronize`, `commit`, effect cleanup | Local operations use `writeQueue`; sync uses a boolean guard; cleanup closes storage without aborting network work or invalidating continuations. | Unmount/close alone is not a purge barrier. |
| PWA `GroceaProvider.tsx:flushPending` | Calls synchronize, then checks outbox; synchronize returns early if another sync is running. It does not await `writeQueue`. | A true flush must join active sync and drain local writes before claiming everything is exported. |
| PWA `App.tsx:AccountGroceaApp` | Purge event starts `storage.destroy()` without awaiting it. Storage object depends on userId; child provider has no explicit account key. | Explicitly key the account subtree and move purge orchestration into an awaitable lifecycle method. |
| PWA `persistence.ts` | Account DB is `grocea:<userId>`; stores are state/canonical/outbox/metadata; `destroy()` closes then calls `deleteDB`. Legacy data has an owner marker. | Close every tab connection; prevent old operations reopening DB; only remove legacy data demonstrably owned by the deleted account. |
| PWA `public/sw.js` | Same-origin `/api` is network-only; static assets are shared. | Keep all new auth/export routes under `/api`; do not clear unrelated origin caches. |

These are source findings, not demonstrated runtime exploits. No current account data was inspected.

## Migration and token lifecycle

Add `PasswordResetToken`: UUID primary key; `user_id` FK to users with `ON DELETE CASCADE`; unique `token_hash BYTEA` constrained to 32 bytes; timezone-aware `created_at`, `expires_at`; optional `consumed_at` if retaining short-lived audit state, otherwise delete consumed rows. Index account and expiry. Avoid storing email, raw URL/token, SMTP message body or password. No separate numeric code/JWT is needed.

Generate `secrets.token_urlsafe(32)` and store only SHA-256 of the ASCII value. Explicitly passing 32 bytes avoids relying on a default that may change. [Python 3.13 secrets](https://docs.python.org/3.13/library/secrets.html)

Suggested project defaults: 30-minute lifetime, 60-second per-address cooldown, at most five requests/hour/address; adjustable bounded configuration rather than security claims. Permit a small bounded number of outstanding links instead of invalidating an already issued link on every new request; otherwise an attacker can continually invalidate a victim's mail. Successful reset and known-password change invalidate all outstanding links. Requesting recovery must never revoke sessions, change passwords or lock the account.

Add a shared PostgreSQL throttle table with composite primary key `(action,subject_digest,window_start)`, count and expiry. Use an atomic `INSERT ... ON CONFLICT ... RETURNING` inside the local implementation, not an in-process dictionary or SELECT-then-INSERT race. This is a proposed application query, not an instruction to execute against a remote MCP server. HMAC normalized email with a dedicated stable secret; process unknown and known emails through the identical address-bucket path. The digest is not an account-discovery response. Also limit request/confirm volume by observed client address and confirm attempts by token digest; do not trust arbitrary `X-Forwarded-For` supplied by the caller. Document the trusted proxy configuration or use the ASGI peer address with its limitations. Throttle keys are pseudonymous abuse metadata; bound retention and prune expired buckets without logging them. No account foreign key is needed for unknown-email throttling.

Address throttling should produce the same generic response for known and unknown emails, including the same retry metadata; an IP-wide `429` is acceptable if determined independently of account existence. Track both throttles across API processes/restarts. Limit attempt work before expensive password hashing. Pruning must be bounded; avoid sweeping all historical rows on every request.

## One lock order for reset, login, password change, deletion and kitchen writes

Use `User FOR UPDATE` as the common account serialization point, followed by token/session rows and then owned domain rows. Reload User with `populate_existing=True` (or explicit refresh) because SQLAlchemy may already have the pre-lock object in its identity map. A SELECT lock alone does not guarantee its in-memory password/revision fields were replaced.

For authenticated writes: validate cookie/Origin/CSRF normally, acquire/refetch User, then query the authenticated session ID against the database again, checking account, expiry and the original CSRF value before **any cached replay lookup or domain operation**. Pass AuthContext/session ID into `apply_mutation`, or have the CurrentAuth dependency acquire this lock and revalidate for every unsafe authenticated endpoint. Keep closure-captured User references coherent by refreshing the existing identity. Adopt one approach everywhere; a helper used only by deletion leaves kitchen writes vulnerable to reset races.

Login must lookup account, lock/refetch it, then verify its current password and create a session while holding the lock. If password hashing is moved outside the lock for performance, revalidate the credential version/hash under lock before issuing a session. Never issue using a successful verification of a now-replaced hash. Password change, session revocation and deletion follow User → AuthSession. Password change should preserve its existing return-new-session contract but revoke reset tokens too.

Reset confirmation can initially read token hash to discover account ID **without locking it**. Then lock/refetch User, requery/lock that token, recheck current expiry/consumption, validate/hash password, update password, invalidate all sessions/tokens and commit. Do not lock token then User: issuance/password-change/deletion may take the opposite order. Two confirmations on one token then serialize; only one succeeds. Expiry is checked after acquiring the lock, so a request blocked past expiry cannot consume it. Notification send happens after commit.

Deletion locks/refetches User, revalidates session/CSRF, then verifies current password under that lock. If a write holds the account lock first, it may finish before deletion; deletion subsequently removes it. If deletion holds the lock first, a waiting write must see missing account/session and fail without recreating records. Reset against a deleted account fails generically. Logout's transaction should use the same order if it participates in these races.

An authenticated read/export that waits on an account lock must also recheck session afterward. There is no promise that a response already authorized and completed before revocation can be withdrawn from the network.

## SMTP and public timing

Configuration: `PUBLIC_APP_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY=starttls|ssl|none`, `SMTP_USERNAME`, `SMTP_PASSWORD` as secret type, `SMTP_FROM`, bounded `SMTP_TIMEOUT_SECONDS`, reset TTL/throttle bounds and stable throttle HMAC secret. Reject missing host/from/origin or inconsistent credential pairs independently of the requested address. Return a generic `503 RECOVERY_UNAVAILABLE` for **every** email when recovery is globally unconfigured; never fake delivery. Use HTTPS origin and encrypted SMTP outside local/test. Permit HTTP/plain SMTP only for explicitly configured loopback test/local hosts. Reject origin credentials, query/fragment and unexpected path components; never derive links from Host, Origin or forwarded headers.

Use Python `EmailMessage` plus `smtplib.SMTP_SSL(...,context=ssl.create_default_context())` or SMTP → EHLO → required STARTTLS with validating context → EHLO → login → send_message. Do not silently downgrade when TLS is unsupported. Set nonzero timeouts; handle timeout, socket, TLS, refused sender/recipient and SMTP errors through redacted error codes. Never enable SMTP debugging: it prints transmitted content. A socket timeout is a blocking-operation bound, not automatically a bound for the entire multi-command delivery/DNS sequence. [Python 3.13 smtplib](https://docs.python.org/3.13/library/smtplib.html)

Keep SMTP network latency out of the public existence-sensitive response. Recommended initial implementation: schedule a bounded real delivery task after committing token state; return the same `202` shape and execute comparable normalization/throttle/database work for known and unknown addresses. A small common response floor may reduce residual database timing differences; jitter alone does not hide conditional synchronous SMTP. The UI message should say “If an account matches, you may receive a reset link. Check your inbox and try again later if needed,” not “Email sent.” Missing configuration is the universal 503 above. Network delivery failures must not become a known-address-only public 503. Use redacted operational status, not a response that reveals the recipient.

FastAPI BackgroundTasks supports work after responding, including mail examples. Use a new database session in the task, never the request-scoped session. [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)

**Reliability boundary:** a process-local task is not a durable mail queue. If a process exits before execution, recovery can require another request. Do not describe acceptance as delivery, or claim exactly-once delivery. Verify the hosting lifecycle before release. If durable retries are required, use PostgreSQL job metadata plus a real dispatcher/scheduler and explicit operational setup; do not add an unevaluated provider or store raw tokens unencrypted in a mail outbox. A dispatcher can generate/commit a new hashed token immediately before sending; each retry generates a fresh token. Implementing such a dispatcher does not authorize scheduling or deployment. A bounded initial task with honest accepted-request semantics is locally implementable now; production lifecycle is a release requirement.

Do not hold User's lock during SMTP IO. Commit the hash before sending so an immediately opened link works. If an unambiguous delivery failure is handled by deleting its token, delete only that token using the common lock order; do not invalidate other links. If SMTP accepted DATA but its acknowledgement was lost, delivery is ambiguous; keeping a short-lived token is safe. Recheck account/token existence before sending when possible; a race can still deliver an already-invalid link after reset/deletion, and that link must be harmless.

Password-change/reset notification uses the same transport after commit, with no password/token in its message. A notification failure cannot roll back an already successful password reset or turn retry into a second successful consumption. Report/log only redacted delivery state; a separate reliable notification retry requires the same lifecycle decision.

Use `PUBLIC_APP_ORIGIN + /reset-password#token=...`. Fragment data is absent from HTTP request URLs; it therefore avoids frontend/proxy/Uvicorn URL logs containing the bearer token. Read it into memory, immediately replace history with a token-free URL, never store it in local/session storage, then POST the token only in a body. Add `Referrer-Policy: no-referrer`, no third-party resources on recovery, and no-store for API responses. Existing main middleware logs only URL path, but Uvicorn/proxy access logs can include query strings; do not choose a query link just because application logs omit them. Validation error handlers/APM must not echo input values. Treat browser screenshots, traces and local SMTP captures as sensitive; keep raw tokens out of reports.

OWASP recommends indistinguishable recovery responses/timing, random expiring single-use credentials, trusted HTTPS reset URLs, no-referrer, user notification and normal sign-in with session invalidation after reset. These recommendations motivate the contract; numeric limits and architecture choices above are project proposals. [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

## Transactional account deletion

Snapshot owned IDs by `user_id == authenticated_user.id`; never use “visible” predicates (`user_id IS NULL OR ...`) for deletion. Before teardown, verify that no surviving foreign-owned/global row references an owned category/ingredient/recipe/activity. The schema does not encode same-owner FKs; services normally enforce visibility, but legacy/inconsistent data can exist. Fail safely and roll back on inconsistent surviving references; never “repair” by deleting another account's records. In particular SET NULL would otherwise silently modify another user's grocery history when deleting a referenced custom ingredient/recipe.

Within the same locked transaction:

1. Delete owned reset tokens and sessions; delete owned `processed_mutations` including their replay JSON.
2. Delete owned grocery lists, using existing cascades for list recipes, items and item sources. Delete owned basket rows before recipes.
3. Delete `stock_changes` whose `event_id` belongs to owned activity. Check ownership via the parent join/subquery; StockChange has no user_id.
4. Clear `reversal_of` **only on doomed owned activity**, then delete that activity. This handles legacy chains/cycles and is confined to destructive account teardown. Normal activity remains immutable. An alternative is proven whole-set deletion under actual PostgreSQL FK behavior, but test imported cycles rather than assuming type-based reversal order is enough.
5. Delete owned pantry stocks, including T05 preferences.
6. Delete owned recipes; recipe ingredients/steps cascade. Those child rows are scoped by parent recipe, not by ingredient ownership.
7. Delete owned ingredients, then owned categories. Include archived rows.
8. Delete User; flush/commit once. Any FK failure rolls back **all** earlier changes.

Cascades alone do not cover restrictive categories/ingredients/recipes/pantry/history/replay FKs. Do not weaken those existing constraints globally merely to simplify teardown. Successful response is cookie-clearing 204 with no body and no local optimistic “deleted” state before server confirmation. A lost response after server commit is an uncertainty case: lock locally, verify session online, and offer retry/cleanup; do not silently resume offline writes. A general 401 alone proves session invalidity, not that an account was deleted.

## Export completeness and exactness

Dedicated allowlisted serializer, `format:"grocea-account-export"`, `version:1`, `exported_at`, `state_revision`, `source:"server"`, and explicit `restore_supported:false`. Stable ordering makes inspection and testing repeatable. Build owned data while holding/refetching User under the same serialization boundary and revalidating session, then release before transmitting the response. This keeps owned rows/revision coherent with concurrent kitchen writes. No user-supplied account selector.

| Export section | Include |
| --- | --- |
| Account/profile | id, email, display name, preferred servings, metric system, created/updated timestamps; omit normalized lookup email if redundant. |
| Custom categories/ingredients | All owned IDs, names, category links, measurement family, archive timestamps, created/updated timestamps. |
| Pantry | Every owned tracked row, including zero/negative balances; ingredient ID, exact quantity; T05 low-stock threshold/preferred refill including null vs zero; timestamps. |
| Recipes | Every owned draft/published/archive; description, servings, ordered ingredient rows with both quantity and quantity_input/unit/position; ordered steps; timestamps. |
| Activity | Every owned event and StockChange; recipe links, title/detail, occurred_at, servings, reversed_at, reversal_of; exact before/delta/after. |
| Basket | Ordered rows, recipe ID, servings, position, timestamps; shared recipe context where needed. |
| Grocery history | Active and completed lists, completed_at, created/updated; recipe_snapshot_id/name/position/servings/base_servings and nullable live recipe_id; each item's live/original ingredient IDs, label/category/family/unit, checked/origin/edited, quantity and original_required/pantry/quantity; every item source snapshot and quantity. |
| Shared references | Labeled global records required to interpret any owned recipe, pantry, activity, basket or list; recursively include categories and recipe ingredients/steps. Keep archive context where referenced. Never include another user's custom rows. |

All decimal quantities are strings with canonical three-decimal precision, not float JSON numbers; UUIDs/timestamps are strings; positions/servings stay integers. Avoid generic ORM dump or casting Decimal to float. No password hash, token hash, CSRF, session ID/cookie, reset record, throttle key, SMTP configuration or replay body. Trial diary is on-device and belongs to T06's separate participant-controlled export; server export must not pretend to include it.

PWA export should drain local `writeQueue`, join an already running sync and inspect metadata/outbox/import conflicts. If any remain or online access fails, say which local work is excluded and require an explicit “Export server data only” choice. A bare `pendingMutationCount === 0` is not a guarantee. Pause new writes for the local check and download, or label the cutoff honestly; cross-device edits can happen later than the returned server revision. If separately including local state, label it a distinct section and serialize bigint exactly; do not merge optimistic data into canonical server records or imply restore support. The simplest scope is server export with an explicit pending-work warning.

## PWA cleanup and races

Create an awaitable account lifecycle method shared by deletion/logout/purge rather than adding more fire-and-forget events. Use an account-specific invalidation generation and message `{type, userId, eventId}` over BroadcastChannel plus storage fallback. Never include credentials or kitchen content. A persisted deletion/cleanup marker must survive tab suspension, missed broadcasts, reload and interrupted `deleteDB`.

1. At final deletion submission, freeze new mutations in the current tab and establish a cleanup generation. Drain `writeQueue`; stop retry timers; abort/join sync requests where possible. Check generation/account after **every await** before writing metadata/state/outbox or applying auth/session responses. Aborting fetch does not undo a server commit; backend locking is still required.
2. Other same-origin tabs receive a pending pause scoped to this account and stop writes/sync. Cancellation/wrong password/network failure before confirmed server success can release the pause without discarding data. Success writes the persistent invalidation marker before cleanup/broadcast. Use a recoverable pending state for unknown response outcomes, not an irreversible deleted marker based on network failure.
3. On success, invalidate session/CSRF/bootstrap/login continuations and in-memory state; remove last-account, unlocked and pending-logout keys only if they belong to the deleted account/current session context. A stale account-A continuation must not overwrite account-B sign-in or clear B's credentials. Auth generation fences are needed as well as storage fences.
4. Close all relevant connections, destroy `grocea:<userId>`, and clear only that account's trial prefix. Define a stable T06 contract now, e.g. `grocea:trial:<userId>:` plus an exact base key if used. Remove legacy storage only when `legacyStorageOwner() === userId`; do not delete unclaimed/other-owner legacy data.
5. Await deleteDB and handle its `blocked` state. `openDB` must close in its `blocking`/versionchange handler; suspended tabs check persistent invalidation before reopening. Keep a cleanup-pending UI/retry path if storage removal fails; server success stays success but “all device data removed” must not be shown prematurely. Keep the privacy-safe tombstone until cleanup is confirmed or until an explicit valid new account lifecycle can safely supersede it.

Do not implement deletion as `reset()`: that replaces seed state and retains metadata/import state rather than destroying account storage. Do not use `localStorage.clear()` or delete every IndexedDB/cache on the origin. API caches should remain absent; static service-worker app shell is shared and contains no account data. Key `AccountGroceaApp`/GroceaProvider by userId so account switching cannot reuse old state refs.

A different offline device cannot receive a browser broadcast or remote cache erasure. Its old session must fail on reconnection; local contents may remain until that device detects revocation/cleans up. Product copy must say server data and this device's account cache are removed, with honest limitations for other offline devices and already downloaded export files.

## Repeatable verification oracles

Use generated local accounts A/B/C, a dedicated explicitly loopback PostgreSQL database, and a real loopback SMTP receiver bound to `127.0.0.1`. Guard scripts against non-loopback URLs and never use existing accounts. Python 3.13 no longer supplies the old smtpd module: use an explicit test-only SMTP receiver such as a small protocol harness or an available local mail catcher, without adding pytest/Vitest. Print pass/fail and redacted counts, never tokens/passwords/email bodies. Receive/reset using tokens in memory. The following are proposed tests, not executed evidence.

| Scenario | Exact oracle |
| --- | --- |
| Known/unknown request | Same status, JSON shape, headers and public message; mail only for generated known account; no raw token in response/DB/logs. Compare repeated shuffled response-latency samples with delayed SMTP receiver; delaying delivery must not delay only the known public response. |
| Missing config/TLS failure | Missing config yields same universal 503 for both emails. No-TLS/invalid-cert server is rejected outside local; no plaintext fallback; redacted operational failure; no false “sent” UI. |
| SMTP failure/acknowledgement | Real accepted message contains configured trusted origin + fragment link. Refused sender/recipient, disconnect and stall terminate bounded attempt; errors contain no recipient/token. Document per-operation versus overall bound. |
| Throttle persistence/race | Concurrent same-address requests across two API processes cannot exceed configured allowance; restart does not reset it; case/whitespace normalization shares one bucket. Unknown address hits identical public policy. |
| Basic reset | Valid token once →204; old password/login and all previous cookies →401; new password normal login succeeds; no automatic session issued; reset notification arrives without secrets. |
| Expiry/replay | Expired token, replay, malformed ASCII and Unicode, arbitrary hash-length input all fail generically; password unchanged. Block confirmation on User lock until after expiry and assert failure. |
| Concurrent token reuse | Barrier-release two confirmations with different new passwords; exactly one 204, one invalid-token response; only winner password works; no extra session/reset token survives. |
| Multiple links/password change | Successful reset invalidates every outstanding link; authenticated password change invalidates outstanding reset links and old sessions while its one new session works. |
| Reset versus login/write/replay | Hold User lock, let request resolve old auth/password, commit reset first, release waiting operation; stale login/session issuance, new kitchen write and cached mutation replay all fail authorization. Reverse ordering may complete write first, then reset revokes. DB counts/revision confirm no post-reset change. |
| Reset versus password change/delete | Deterministic lock barriers in two DB sessions establish order; losing operation fails or uses refreshed credentials; no deadlock or surviving deleted account/session/token. |
| Export full graph | A has archived custom rows, draft input, negative and zero stock, T05 null/zero settings, cooked+reversed history, manual/generated active and completed groceries with source snapshots, shared global references and basket. Every listed export field matches DB; all referenced custom IDs belong to A; no B content/secrets/replay JSON; Decimal strings exactly preserved. |
| Export snapshot | Concurrent mutation blocked by export lock; export revision and quantities describe entirely before or entirely after committed write, never mixed owned state. Revoked waiter cannot export. |
| Deletion reauth/cancel | Wrong password, missing/invalid CSRF and wrong confirmation delete zero rows; UI Cancel makes no DELETE request. Offline attempt preserves data and reports connection requirement. |
| Deletion full FK graph | Delete disposable A with full graph and archived rows; all A-owned rows and children/replays/sessions/tokens gone; B and global rows identical before/after; B references to global records continue working. |
| Legacy reversal graph | Generated legacy import with allowed nonstandard reversal type/chain/cycle; teardown handles it safely. Inject foreign-owned reference only in isolated fixture DB: deletion fails atomically rather than changing B/global rows. |
| Deletion rollback | Force a late restrictive FK failure; earlier session/history/replay deletes also roll back. No partial account removal. |
| Delete versus sync/reset | DELETE first: waiting authenticated write/import/replay/reset fails and cannot recreate data. Write first: DELETE removes its committed rows. A lost DELETE response leaves cleanup uncertainty, never unsafely resumed writes. |
| Storage and cross-tab | Two tabs with real durable IndexedDB/outbox, one paused at network response and one at local write await; deletion aborts/fences both continuations; no reopened/repopulated A DB, no auth resurrection, trial keys cleared, B DB untouched. Repeat without BroadcastChannel and with suspended tab resuming. |
| Blocked cleanup | Hold IDB connection in another tab; block removal, show pending cleanup, close connection on versionchange, retry completes; no premature complete UI. Reload halfway through cleanup resumes from tombstone. |
| Pending export | Queue local mutation but pause before enqueue completes; export sees it after drain; active sync is joined rather than skipped; failed outbox/import conflicts require explicit exclusion choice. |
| Offline device/re-registration | Separate browser context stays offline with old A cache; server deletion cannot erase it. Reconnect rejects old session. Re-register same email gets a fresh UUID with no old pantry/replay, and stale A writes cannot import into the new account. |

After implementation: execute plan build/targeted lint/Ruff/mypy/OpenAPI generation, API scenarios above, and browser recovery/export/deletion at phone/tablet/desktop. Record actual commands and pass/fail in task evidence. Physical installed-device behavior, production SMTP credentials/delivery and hosting task lifetime remain external release verification; no completion claim follows from this document.
