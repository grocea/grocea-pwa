# Grocea implementation plan

feature_id: GROCEA-2026-10
status: in_progress
model: gpt-6.1-sol
prepared: 2026-10-16
preparation_gate: [FEATURE-PREPARATION.md](FEATURE-PREPARATION.md)

## Task register

| ID | Task | Status | Dependencies | Plan |
|---|---|---|---|---|
| T01 | Offline reliability and verification | draft | T02 → T03 → T05 → T04 → T06 → D1 | [Plan](plans/01.md) |
| T02 | Standalone shopping and restock-to-list | done | none | [Plan](plans/02.md) |
| T03 | Fast pantry setup and bulk adjustments | done | T02 | [Plan](plans/03.md) |
| T04 | Account recovery, export and deletion | done | T05 | [Plan](plans/04.md) |
| T05 | Optional low-stock and refill preferences | done | T03 | [Plan](plans/05.md) |
| T06 | One-week trial toolkit and opt-in collection | done | T04 | [Plan](plans/06.md) |
| D1 | Targeted marketing repair (verified; report available) | done | T06 | [Plan](plans/D1.md) |

## Execution governance

mode: CODE-FIRST, NO-FICTION, ONE-IMPLEMENTATION-OWNER
implementation_order: T02 -> T03 -> T05 -> T04 -> T06 -> D1 repairs -> T01 final integration
agent_policy: all spawned agents use requested gpt-6.1-sol; sequential application edits avoid shared provider/API/CSS conflicts. Design evidence collection may run independently without application edits. Root owns plan integration and review.
prompt_policy: write docs/next-phase/prompts/TNN.md with RESUME_FROM, scope, verification strategy and external requirements before dispatch; agents read canonical plan.
no_fiction_policy: no invented users, study results, delivery, device verification, commits or screenshots
mock_policy: no fake backend/integrations in acceptance; synthetic records are test data only; design demo is explicitly labeled and cannot satisfy real sync verification
placeholder_policy: production SMTP/device/study prerequisites are external requirements, never silently implemented as stubs
done_policy: mark done only when code, required local checks, review evidence and docs pass; keep physical devices/production delivery/real study separately pending
commit_policy: verified commits and pushes to feature branches are authorized; no deployment or remote migrations
rollback_policy: preserve user's pre-existing edits; revert specific task changes only; no destructive Git commands
review_policy: root reviews each task, maximum three correction loops, then report a concrete blocker without abandoning independent work
wiki_policy: current product/API facts go in PRODUCT.md/README/compact STATUS; never record secrets or invented outcomes

## Verification policy

- Existing pytest and Vitest removals remain respected. Use focused executable integration scenarios, standard-library clients and available browser tooling.
- Use fresh local databases/accounts. The host has loopback PostgreSQL on 5432; do not read/write the user's production backend or reset existing databases.
- Each task records actual command, result and evidence in reports/next-phase/task-NN.md. Planned commands are not executed evidence.
- T01 reruns the integrated journey after all mutations/UI changes.
- Marketing taste inspection uses 390/768/1440 widths; actual app workflow/keyboard/state checks use app design rules and preserve approved navigation.

## External requirements (remain pending)

- Installed physical-device checks and remote API confirmation after explicit deployment authorization.
- SMTP production configuration and delivery verification.
- Real consenting participants and seven elapsed days of research. Toolkit/collection implementation is T06; the real study is not claimed complete by that task.

## Design gate

Design study is complete with actual screenshots and taste lint/inspection. Screenshot audit confirms targeted app improvements, with no wholesale visual rewrite. Public welcome needs a contained composition/copy repair; observed tablet overflow and desktop wordmark contrast are concrete defects. Public welcome repair may proceed only from the recorded critique and must preserve pre-existing user edits. No full application rewrite is approved by assumption.
