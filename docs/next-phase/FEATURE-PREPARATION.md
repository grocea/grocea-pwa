# Grocea next phase — feature preparation

feature_id: GROCEA-2026-10
status: ready_for_local_implementation
user_authorization: User requested analysis, individual plans, and implementation by GPT-6.1 Sol subagents on 2026-10-16. User selected standard SMTP for recovery.
source_of_truth: TASK-PLAN.md plus the six linked plans. Product policy remains PRODUCT.md.

## Evidence and rationale

- Source-reviewed PWA uses React/TypeScript, IndexedDB, optimistic local mutations, dependency-aware outbox, per-account revisions and exact bigint quantities. Backend uses FastAPI, PostgreSQL, immutable activity and mutation replay.
- New grocery-list creation requires Basket recipes. Existing lists support manual items. Pantry restock rows navigate to stock adjustment.
- Pantry setup is one ingredient at a time. Bulk stock transactions and pack-count input are absent.
- Auth supports register, login, session, logout and known-password change. Recovery, personal export and account deletion are absent.
- Pantry tracks aggregate balances; optional restock thresholds/refill amounts are absent. Expiry/batch semantics would be a separate domain change.
- Existing sync-issue UI already exposes retry/discard. Production service-worker and actual authenticated offline/reconnect coverage need verification.
- ML receipt OCR/Jev is a separate prototype, not a production receipt-to-pantry contract.
- Product notes establish no user-study outcome evidence. A real one-week trial needs consenting participants and elapsed time.
- Design audit is running in reports/next-phase/design-study.md. Initial source/visual direction retains app navigation and Kitchen Ledger identity; public-page repair is scoped separately.

## Decisions

- Implement standalone shopping lists and direct restock-to-list without consuming or changing recipe Basket. Preserve one active list per account.
- Bulk stock updates are atomic and use exact canonical metric quantities; pack arithmetic is explicit and previewed. All rows validate before save.
- Optional low-stock threshold uses balance <= threshold; default remains depleted (<= 0). Preferred refill quantity means amount to buy, not desired final balance. These settings belong to each tracked pantry ingredient and sync between devices. No push notification infrastructure.
- Recovery uses configurable standard SMTP; test only with loopback receiver and generated local accounts. Real delivery/setup is a release requirement, not a fake success path. No token appears in API responses or logs.
- Export returns an authenticated, versioned kitchen snapshot, without passwords/session/reset secrets. It is an export, not a promised restore workflow. Warn if unsynced work is excluded or include clearly labeled local state.
- Account deletion requires online reauthentication, explicit UI confirmation, account-scoped transactional deletion, session invalidation, local cache/outbox cleanup and cross-tab invalidation. Never execute against existing real accounts during tests.
- Trial support is opt-in, local to the account/device, with milestone/diary export controlled by the participant. No external analytics, automatic transmission, invented feedback or contacting participants.
- Complete audit before public-site editing. Preserve pre-existing WelcomePage.tsx and .gitignore changes; no blanket resets. Existing app glass navigation is user-approved and outside marketing taste rules.

## Scope and boundaries

scope_in: six plans, local backend/PWA implementation, generated contracts, local integration/browser verification, evidence reports, study kit, targeted public-site design repair justified by audit.
scope_out: deployment, real-account deletion, remote DB writes/migrations, sending external email/messages, household sharing, expiry batches, recipe import, production OCR integration, external analytics services, reinstating pytest/Vitest.
constraints: PWA-first with desktop support; metric-only; privacy by personal account; no credentials or real user pantry screenshots in reports; no fabricated product claims.
existing_user_edits: grocea-pwa/.gitignore and grocea-pwa/src/features/marketing/WelcomePage.tsx were modified before this work.

## External completion requirements

- Physical installed-iOS/Android checks require those devices; local Chromium browser coverage is labeled separately.
- SMTP production host/credentials/from-address and deployed origin must be configured and verified after release authorization.
- Remote tracking/API verification requires explicitly authorized deployment.
- Actual study participation and a full week of observation cannot be manufactured; implementation can deliver a working toolkit and collection controls now.

## Sources consulted

- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html — reset response consistency, random expiring single-use tokens, rate limiting and session revocation.
- https://web.dev/learn/pwa/offline-data — durable storage and storage-loss boundaries.
- https://web.dev/learn/pwa/update — service-worker update lifecycle.
- Local design-taste-frontend, redesign-existing-projects, webapp-ui-skill and TASK-PLAN v2 skills; specific brand/product requirements outrank generic style suggestions.
