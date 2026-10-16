# T06 — opt-in local trial journal and study kit

Implemented 2026-10-16 in the isolated T06 PWA worktree. Backend unchanged. No deploy, commit, push, external messages, telemetry transport, participant recruitment or study results were produced by this implementation.

## Behavior delivered

More → One-week trial opens an off-by-default account/browser journal. Explicit checkbox consent starts a fresh consent period. Stop invalidates pending candidates and retains previous entries; clear removes all journal data using T04’s exact `grocea:trial:<account>` namespace. Start again requires clearing and consenting again. Participant-entered notes support add/edit/delete; notes are explicitly not automatically redacted. Direct JSON download whitelists dates, coarse outcomes and optional note text, excluding account, mutation and consent-period identifiers. Browser data loss can erase the journal; it does not sync between devices.

The commit hook captures the consent period at action invocation, before the primary write queue. It creates a coarse candidate only after durable local state/outbox save. Only successful server acknowledgement promotes an existing candidate from the same active consent period. Pre-consent, stopped, cleared, rejected, revision-conflicting, dependency-blocked or discarded actions cannot count later. Pantry setup is the first accepted `stock.operation`/`stock.bulk` during the period; each accepted `grocery-list.complete` or `recipe.cook` counts once. These are workflow proxies, not proof of an inventory, purchase or meal.

Later-day returns use distinct local dates after the start date, triggered by visible initial visits, focus/visibility return or interaction. No timer-only return recorder exists. All mutations validate stored shape and account availability. Optional storage/lock failures pause journal collection and do not throw into pantry changes or acknowledgements. Web Locks serialize short account-scoped journal updates across tabs; core kitchen work does not await these optional tasks. Recording requires Web Locks; clearing remains available without them. Journal errors may leave missing outcomes; absence is not evidence of non-use.

[Study kit](../../docs/trial/ONE-WEEK-PROTOCOL.md) includes organizer preparation, separate voluntary consent choices, daily tasks and blank diary, six-goal outcome definitions, exit interview, qualitative review rubric, withdrawal/retention prompts and explicit external requirements. Organizer must fill in contact/data-access/retention fields before recruiting. No invented participant observations are included.

## Executed checks

- `npm run build` — passed after final changes. Existing bundle-size advisory remains (approximately 594 kB minified JS); no compiler error.
- `npx eslint src/app/trial-journal.ts src/features/trial/TrialScreen.tsx src/app/GroceaProvider.tsx src/app/App.tsx src/features/more/MoreScreens.tsx` — passed, no warnings/errors in final run.
- `git diff --check` — passed.
- `node tools/verify-trial-boundaries.mjs` — passed. Transpiles actual module/lifecycle code for executable Node checks with controlled storage/lock mocks: off-by-default, original consent period, ACK dedup, rejection, stop/clear, same-day versus later-day returns, note edit/delete, export whitelist, account ownership guard, quota/blocked-read failures, malformed nested records, missing/synchronously failing Web Locks, and T04 deletion namespace. These are focused synthetic boundary tests, not API/browser outcome evidence.
- `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-trial-browser.mjs` — passed ten reported checks using the production build on loopback 5184 and actual generated accounts against root’s isolated API8000. Production page **and service-worker** networking were disabled for offline checks. Pre-consent offline stock action was excluded after opt-in/reconnect; consented stock candidate survived a true offline reload and was promoted once after real acknowledgement. Notes add/edit/delete and direct export whitelist passed. Stop/clear invalidated pending candidates across reconnect/new consent. Injected trial-only quota failure during a real ACK produced a paused journal while the kitchen outbox drained successfully. Actual disposable-account deletion cleared an actual journal using the shared namespace. [Machine results](task-06-browser/results.json).
- `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-trial-tabs.mjs` — passed three same-origin real Chromium/Web Locks cases: simultaneous ACK + note retains both; stop + ACK leaves stopped consent/no resurrection; a held lock cannot grant new consent to an originally unconsented action. This uses the actual module transpiled to browser data modules and **synthetic journal-only candidates**, not real server acknowledgements. [Machine results](task-06-browser/tabs.json).
- `GROCEA_CDP_MODULE=/Users/ammar/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs node tools/verify-trial-flows.mjs` — passed five focused cases. UI standalone list with a checked 1000 g catalog-backed item completed with Pantry update and one acknowledged shopping outcome, confirmed as completed on the server. UI recipe cook preview/confirm produced one accepted cooking outcome. A real second mutation advanced server revision; stale local bulk save received actual `STATE_REVISION_CONFLICT`, removed its trial candidate, and discard did not promote it. Actual sign-out/new-account flow showed journal off and no storage under the second account’s exact ID while first-account storage remained private. A controlled past start date/hidden-visibility simulation suppressed hidden events, then recorded only one visible later-date interaction; this is **not seven elapsed days or a physical-device background test**. Prior grocery steps were explicitly settled through the existing Synchronization UI; one manual retry was invoked in this final run. [Machine results](task-06-browser/flows.json).
- `node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/check_state_coverage.ts --root . --out reports/next-phase/task-06-state-coverage.json` — passed repository lexical state markers only. It is not runtime accessibility or state proof. Generic visual-smoke script was skipped in favor of task-specific authenticated browser checks.

The local production fixture ran with `python3 tools/serve-local-build.py --port 5184`; it was stopped before handoff. Root owns API8000; it was not stopped. No backend checks or contract regeneration were repeated.

## Visual evidence

The task-specific browser suite checked no document horizontal overflow at 320, 390, 768 and 1440 px and captured journal screenshots. Phone and desktop screenshots were inspected: readable Kitchen Ledger typography, green identity, existing app glass navigation/sidebar retained, controls fit and wrap. These images capture the first viewport (the helper’s full-page flag does not expand them), so they are not proof that every lower section was visually inspected. Interactive notes/clear controls were exercised separately.

- [Phone journal](task-06-browser/journal-390.jpg)
- [Narrow phone journal](task-06-browser/journal-320.jpg)
- [Tablet journal](task-06-browser/journal-768.jpg)
- [Desktop journal](task-06-browser/journal-1440.jpg)
- [Real revision conflict](task-06-browser/trial-conflict-768.jpg)

All fixture contents are synthetic. Screenshots/reports contain no credentials, tokens or participant records. The trial module/screen adds no `fetch`, beacon, WebSocket or other telemetry transport; that is source inspection, not a comprehensive network-capture audit.

## Initial failures and T01 integration follow-up

The first broad browser run used a nonexistent sync-status selector as its reconnect oracle; it was corrected to inspect actual durable outbox drainage and passed.

Rapid grocery sequences in the focused harness exposed an integration follow-up that is **not dismissed as test flakiness**:

1. Start trial → Start shopping list → immediately Complete list → Complete without Pantry update: one run timed out after 15 seconds waiting for an accepted shopping outcome. A later unchanged retry passed. A subsequent run that waited for list-creation outbox drainage still timed out, with journal `active: true`, zero outcomes, **one pending candidate**, and no visible warning banners. The server list state and outbox status were not captured before retry, so this observation alone cannot establish whether the completion was unsent, accepted or waiting; it must not be claimed as accepted journal loss.
2. Start list → immediately add 1000 g catalog item → immediately click its purchased checkbox: a run timed out waiting for the checked row. The dialog’s hidden DOM text reported one item not marked purchased. At diagnostic time the journal had zero outcomes and zero candidates. This is a plausible user-visible rapid-edit issue, not proof that checking was invalid.

Root’s source review identified a likely existing synchronization window: after `remaining.length === 0`, synchronize awaits `fetchState()` and adopts canonical state without a post-fetch outbox/write-epoch guard. A commit during that interval can be overwritten or miss a subsequent scheduling pass. That explanation is **source inference**, handed to T01 for reproduction/fix/integrated verification. T06 does not change kitchen sync behavior. Final settled-flow evidence proves trial mapping for actual acknowledged actions; it does not close rapid-edit synchronization coverage.

## Remaining limits

Actual 3–5 consenting participants, seven elapsed days, recruitment, interviews, shared-export retention and physical iOS/Android checks remain external and incomplete. No study results, savings or waste reduction are claimed. Journal collection does not replace organizer consent/retention arrangements. Device clock changes, cleared browser data, multiple devices and storage failures limit return/outcome interpretation. Full browser/screen-reader/accessibility and live network telemetry audits were not performed. T01 owns the observed rapid grocery integration follow-up and final combined offline verification.
