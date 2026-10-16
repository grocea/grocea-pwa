# Next-phase delivery

Local implementation and verification, 2026-10-16–17. No deployment, remote database changes, external email, or participant study was performed. Original working-tree application edits and separate logo assets remain untouched.

## Cumulative branches

| Work | Branch | PWA verified predecessor | Backend |
|---|---|---|---|
| Standalone shopping | codex/grocea-02-shopping | e8472d2 + docs120cb6a | eebafc1 |
| Bulk Pantry | codex/grocea-03-bulk | 88c4573 + docs50fd9e2 | 3c4d95b |
| Threshold/refill preferences | codex/grocea-05-restock | e1227d7 | 54a5a63 |
| Recovery/data controls | codex/grocea-04-account | d81c169 + docs b6cab38 | 0bdcc81 |
| Opt-in local trial | codex/grocea-06-trial | 781eceb | 0bdcc81 unchanged |
| Public welcome repair | codex/grocea-d1-welcome | fbba476 (source0bd4acd) | 0bdcc81 unchanged |
| Final offline integration | codex/grocea-01-offline | Verified final branch; resolve implementation commit with `git log codex/grocea-01-offline` | 0bdcc81 unchanged |

Final PWA branch inherits all preceding work. Backend requires migrations0005 (Pantry preferences) and0006 (recovery/rate-limits/account controls); both were applied only to isolated local fixture `grocea_next_phase_20261016`. Apply migrations to another environment only within a separately authorized release. Keep SMTP trusted origin/sender/transport configuration and process-task lifetime in that release plan.

## Evidence

- [T02 shopping](../../reports/next-phase/task-02.md): standalone/recipe-generated shopping, account isolation, replay/revision, completion and Basket preservation.
- [T03 bulk Pantry](../../reports/next-phase/task-03.md): atomic exact quantities, packs, one event/revision, rollback and offline persistence.
- [T05 thresholds](../../reports/next-phase/task-05.md): private thresholds/refill, boundary behavior, validation and import semantics.
- [T04 account controls](../../reports/next-phase/task-04.md): real local SMTP/reset/revocation, export and deletion/fencing.
- [T06 trial](../../reports/next-phase/task-06.md): consent, account/storage boundaries, real acknowledged outcomes and explicit controlled date simulations.
- [D1 public repair](../../reports/next-phase/design-final.md): four coherent synthetic actual-app crops and production/phone/desktop review.
- [T01 final integration](../../reports/next-phase/task-01.md): final exact executed checks, race before/after, worker update/cache oracles and remaining limits.

These are synthetic integration observations, not customer outcomes. T01’s machine evidence distinguishes controlled outages/mutation blocking and generated A/B/broken outputs from ordinary runtime behavior.

## Release and external work

Physical iOS/Android install/reopen after OS termination, icon cropping, safe areas/touch/assistive technology, intended hosted headers/scope/update transition, standard SMTP provider configuration/TLS/task lifetime/inbox delivery, remote deployment/migrations and consenting 3–5 participants over seven elapsed days remain pending. No savings/waste/research result is claimed. Other devices and downloaded exports can retain account data after deletion; sign out or clear site data there. Browser storage eviction can remove offline capability.

The legacy deployed worker cannot be changed underneath its already-open clients: the new coherent versioned-shell guarantee begins after old tabs close and the new worker activates. Natural waiting updates preserve queued mutations and old clients; exact-content cache repair refuses newer-origin bytes for an older active build. A successfully downloaded newer build can be adopted by closing all Grocea tabs and reopening. No immediate-force-update action is added.
