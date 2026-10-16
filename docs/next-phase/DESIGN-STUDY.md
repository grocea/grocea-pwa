# Grocea next-phase design study

Study date: 2026-10-16. Audit only; no application source changed. Browser evidence uses the development demo, simulated authentication, and synthetic kitchen data on `http://127.0.0.1:5183`. It does not prove real authentication, backend synchronization, offline persistence, installation, or user outcomes.

## Decision

A large app visual rewrite is **not warranted**. Kitchen Ledger already supplies a coherent palette, readable operational rows, consistent controls, and a useful desktop/mobile shell. Keep the approved five-destination glass navigation, desktop sidebar, and exact metric quantities. Improve the workflow model and specific responsive/accessibility defects inside that system.

The public welcome page merits a **contained composition and copy rework**, after core workflows are implemented. Its present mock product view is tiny, the hero headline is three lines at every tested width, and the tablet composition clips content. Do not apply public-page prohibitions on borders, labels, cards, or glass to the signed-in app. Marketing's screenshot count and motion minimum are style conventions, not evidence that the product is unusable.

Recommended scope: (1) reliability verification and visible save states, (2) direct shopping/restock, (3) bulk pantry workflows/pack entry, (4) recovery and account data controls, (5) optional replenishment settings, (6) opt-in trial support. Fix confirmed small visual regressions alongside the relevant feature. Avoid a font/library/framework migration or a replacement app shell.

## Evidence and method

Read `AGENTS.md`, `.wolf/OPENWOLF.md`, `.wolf/STATUS.md`, `.wolf/cerebrum.md`, product policy, relevant screen source, and style selectors. Used:

- `/Users/ammar/.agents/skills/design-taste-frontend/SKILL.md`, public marketing only: source lint, real-browser inspector, all six generated screenshots opened and critiqued.
- `/Users/ammar/.agents/skills/redesign-existing-projects/SKILL.md`, signed-in app: diagnose first, targeted upgrades in existing stack.
- `/Users/ammar/.codex/skills/webapp-ui-skill/SKILL.md`, signed-in app: operational density and state model. Its relative shared privacy/visual-verification reference paths were absent; kept all screenshots local with synthetic data. No external uploads.

Exact audit commands (run from `grocea-pwa`):

```sh
npm run dev:demo -- --host 127.0.0.1 --port 5183 --strictPort
node /Users/ammar/.agents/skills/design-taste-frontend/scripts/lint.mjs src/features/marketing/WelcomePage.tsx src/features/marketing/welcome.css
node /Users/ammar/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:5183/welcome --out reports/next-phase/design/marketing --widths 1440,768,390
node reports/next-phase/design/capture-app.mjs
node reports/next-phase/design/capture-details.mjs
node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/check_state_coverage.ts --root /Users/ammar/Documents/Grocea/grocea-pwa/src --out reports/next-phase/design/state-coverage.json
node /Users/ammar/.codex/skills/webapp-ui-skill/scripts/visual_smoke_test.mjs --url http://127.0.0.1:5183/pantry --out reports/next-phase/design/smoke
```

Local listening/browser commands required sandbox escalation and were approved automatically. No deployment, commit, remote account changes, or DB mutation occurred. Existing `WelcomePage.tsx` work was only read. `.gitignore` was not edited.

Viewports: marketing 1440×900, 768×1024, 390×844; app 1440×900, 768×1024, 390×844, plus 320×740 for Pantry, stock adjustment, and shopping. Main app capture contains 30 route/viewport samples plus restock and profile captures. Screenshot files are in `design/marketing/` and `design/app/`. Browser metrics and console exceptions are recorded in `design/app/metrics.json`; no runtime JS exceptions occurred in that route sample. This is a local happy-path sample, not comprehensive QA.

Development-demo control is visible over the lower-right screen in these captures. It is development-only, may cover real content in the evidence, and must not be mistaken for a production control or an app accessibility failure. `profile-bottom-*` captures attempted window scrolling, but the app scrolls `.app-page`; use `profile-scrolled-*` for actual lower profile evidence.

## Signed-in app findings

| Priority | Observed finding | Evidence | Targeted response |
| --- | --- | --- | --- |
| P1 workflow | Restock items open stock adjustment. The restock view offers Add stock and Track ingredients; no direct purchase action. | `app/restock-390.jpg`, `pantry/screens.tsx` row link | Add selection and “Add to shopping list”; stock changes remain a separate explicit action. |
| P1 workflow | New grocery creation is recipe Basket based. Existing lists support manual items, but standalone creation is absent. | `app/groceries-390.jpg`, GroceriesScreen empty-state source | Put “New shopping list” on Groceries; recipe-generated shopping remains an alternate entry. |
| P1 workflow | Single-ingredient stock form is clear but expensive to repeat for setup and a whole shopping bag. | `app/stock-1440.jpg`, `app/stock-390.jpg` | Add batch selection/entry/review, preserving current adjustment form for one-off corrections. |
| P1 access | Profile offers password change, but UI lacks forgotten-password, export, and deletion paths. | `app/profile-390.jpg`, AuthScreen/ProfileScreen source | Add recovery routes and Account & data section with online requirements and pending-change safeguards. |
| P2 visual | Desktop wordmark is white on a pale sidebar, nearly invisible. | `app/pantry-1440.jpg`, `app/profile-1440.jpg` | Set wordmark foreground for the current light surface. Legacy `app.css:403` white survives later sidebar fill near `:1891`. |
| P2 hierarchy | At 390px, pulse, filters, and actions consume most of the first fold; first stock row begins around y=618. At 320px no useful stock row is visible before navigation. | `app/pantry-390.jpg`, `app/pantry-320.jpg` | Reduce mobile pulse to a compact summary; keep task controls close to rows; adapt restock view's primary action to shopping. |
| P2 workflow | Manual-only list shows “Recipes used for this list · 0 recipes” and “Return recipes to Basket.” | `app/shopping-390.jpg`, `app/shopping-1440.jpg` | Hide recipe source/return controls when there are no source recipes. Keep list delete in a quieter management menu. |
| P2 interaction | While Add item editor is open, sticky Complete list remains the dominant action; editor Add item is initially below/clipped by the footer at mobile sizes. | `app/item-editor-390.jpg`, `app/item-editor-320.jpg` | Let editor save/cancel own the sticky action area while editing, preserve unsaved input, and prevent accidental list completion until draft is resolved. |
| P2 trust | Global sync indicator is icon-only visually; text is screen-reader-only/title. A cook may miss queued versus remotely synced state. | `app/pantry-390.jpg`, BrandHeader source | Keep normal state compact; show visible text/count for offline, queued, first-sync, or failed states; link to recovery details. |
| P2 touch | Shopping checkbox itself is 24×24px; actual label hit area requires inspection before calling it a failure. | `app/shopping-390.jpg`, metrics | Ensure effective target at least 44×44px; make the item label/toggle target generous without making edit/delete trigger purchase. |
| P2 narrow fit | Needs-restock segment/count crowds its control edge at 320px; no document overflow detected there. | `app/pantry-320.jpg` | Allow a compact label/count layout; test text resize and long localized labels. |
| P3 density | Catalog uses readable names but 10–11px secondary category/status labels. | `app/catalog-390.jpg`, style source | Increase meaningful helper/status text toward 12–14px; preserve compact rows and numerical alignment. |

App root measurement flagged stock-adjustment document width 799px at 768px. Follow-up element measurement found the actual offender: a `p.sr-only` projection announcement at x≈31 with width 768px (right≈799px), while `.app-page` remained 768px. This is hidden accessibility content inheriting layout width, not visible form-grid overflow; fix the visually-hidden sizing specificity. At 320px, hidden header-action/history-status boxes extend to x=340 behind the shell clipping; check their hidden/responsive behavior. Nested `.app-page` also needs scroll-width checks because document width alone can miss overflow hidden by the shell.

## Workflow design for the six goals

### 1. Reliability, installation, and offline confidence

Keep existing sync surface; add clear state language: “Saved on this device”, “3 changes waiting to sync”, “Syncing”, “Synced”, and “Needs attention”. Do not label local optimistic saves as remotely synced. During first sync, show why editing is unavailable and the next action. Reconnect retries should preserve drafts, avoid duplicate activity, and explain conflicts with human item names before technical details.

Acceptance: installed PWA first online sign-in and sync; offline relaunch; pantry edit, tracking, shopping checkoff and completion, recipe/cook flows offline as supported; reconnect; cross-device revision conflict; failed request retry; stale calculations; sign-out with unsynced work; storage-full/interrupted save. Verify replay/idempotency and final balances/history. Native device safe areas, keyboard, screen readers, Safari and Android installation remain manual checks. Synthetic demo auth cannot close any of these release gates.

### 2. Standalone shopping and restock-to-list

Groceries home: one dominant “New shopping list” action when no active list; secondary “Build from recipes”. If an active list exists, “Open list” stays primary and restock additions append to it. Start with one active list to respect the existing model rather than adding list switching complexity.

Pantry restock: select individual ingredients or all visible results, then “Add 3 items to shopping list”. Review names, current stock, purchase quantity, and unit before adding. If quantity is unknown, allow “Amount not set”; do not invent a 1-unit recommendation. Already-listed items show a conflict/merge preview; explain whether amount is retained or increased. Show “Added to This week’s groceries” with an Open list link.

Shopping rows: named item, amount, purchase toggle, edit menu. Free-text items need no pantry mapping; only mapped ingredients with valid quantities can update Pantry. Empty manual list says “Add the first item”; “Your pantry has all required ingredients” belongs only to a recipe calculation. Hide empty recipe disclosures and recipe-return actions.

Completion: distinguish planned amount from actual bought amount, preview pantry before/after, let cooks exclude a purchase from stock, and warn about unchecked items. Keep existing explicit completion confirmation. Do not silently add to stock when checking an item off.

### 3. Bulk pantry setup and updates with pack quantities

Entry points: Pantry “Set up pantry” for an empty account, “Update several items” for ongoing use. Avoid a mandatory onboarding wizard. Desktop: selection list/table beside a review panel. Mobile: search/select, then a compact stacked quantity editor and sticky review action; back preserves entries.

Each row uses an explicit operation: “Add purchased amount” or “Set total on hand”. Batch setup defaults to Set, a shopping update to Add. Row fields: ingredient, amount/unit, optional pack count × amount per pack, computed exact total, existing balance, resulting balance. Example: 3 packs × 250 g = 750 g; current 200 g → 950 g. This is a synthetic instructional example, not proof of a measured user result.

“Pack” is an input aid, not a new canonical measurement family. Store canonical mass/volume/count and preserve intended operation; support fractions in item units where appropriate. Do not treat pack count as stock count for a mass ingredient. Validate per row and focus the first invalid row. Duplicate ingredient rows must merge transparently or require resolution before save. An untracked ingredient explicitly selected for stock becomes tracked according to product policy.

Review: “Update 8 ingredients”, with deltas and final balances. Offline save confirms local persistence. Partial failures remain editable/retryable and cannot duplicate successful rows; backend may choose atomic batch validation or clear per-item result mapping. Activity must retain per-ingredient changes with a shared batch context, never overwrite immutable history. Cancel leaves stock unchanged.

### 4. Password recovery, export, and account deletion

Sign-in adds “Forgot password?” near password field. Recovery: email entry → neutral “If an account exists, recovery instructions have been sent” → valid reset link → new password and repeat → success and sign-in. Expired/used/invalid links have a clear request-another-link action. Request/reset require online availability; no simulated success in production. Password managers/autocomplete, visible validation, and focus movement are essential. Backend delivery, token expiry, throttling, and session revocation must support the UX.

Profile can remain Profile initially, with separate “Account & data” group below preferences/security. Export: explain format/content and local-versus-server completeness. If pending changes exist, offer Sync first or an explicitly labeled export including local pending state; never claim completeness of a server-only export while work is queued. Download should have a clear file name/date and readable success/error state.

Deletion: warning page with actual scope, offline cache effects, history loss, pending change count, export link, reauthentication, and explicit final confirmation. Do not delete account on entering the screen. Require online verification. After confirmed server deletion, clear account-specific local data/session and return to a public completion state. Failure preserves access and reports what remains. Avoid an ornamental danger card dominating ordinary profile tasks.

### 5. Optional low-stock thresholds and refill amounts

Attach optional settings to tracked ingredient detail/editor, not global mandatory setup. Toggle “Warn when stock is low”, then a threshold in compatible metric/count units; separate “Usual refill amount”. No value is implied from the other. Distinguish a trigger threshold from a target stock level; if the implementation chooses a target, label it explicitly and calculate only the positive difference.

Default off preserves zero-only Needs restock. When enabled, positive stock at/below threshold is “Running low”; zero/negative tracked stock remains “Needs restock”. Untracked catalog entries never generate replenishment reminders. Threshold and refill unit family must match the ingredient. Show status in text as well as color. Restock list can group Empty and Running low; small filters should not add a third competing navigation model. Suggested quantity is editable before list addition, and already-listed ingredients remain deduplicated.

### 6. Opt-in one-week user trial support

Small opt-in in More or first-use help: what the week involves, what data is recorded, how to stop, and how to contact `grocea@aeyslo.lol`. A dismissible checklist can cover adding stock, making a list, shopping, and recording a meal. Use actual product tasks and no invented reward, completion streak, savings metric, or testimonial.

A “Send feedback” action may prepare an email with optional task context and app version. Never attach kitchen/account data automatically. Progress can be local and explicitly labeled; do not add analytics infrastructure without a separate data decision. Support scripts/checklists can live in documentation first. No automatic reminders, email sends, or external messaging are authorized by this design study.

## State and interaction contract

| Surface | Required states before release |
| --- | --- |
| Shopping/restock | no list, empty manual list, empty recipe result, no matching ingredients, already listed, duplicate amount conflict, unknown amount, edited amount, purchased, partly purchased, completion preview, saving locally, queued, failed, retry, success |
| Bulk stock | no selection, filtered empty, invalid units/amount, duplicate rows, add/set distinction, resulting negative balance, changed underlying stock, review, saving, partial/atomic failure, retry, success, cancel with unsaved input |
| Recovery/account | missing/invalid email, neutral request success, offline, throttled/server failure, expired token, password mismatch, submitting, reset success, pending local changes, export unavailable/ready/failure, reauth required, deletion failure/completion |
| Thresholds | disabled, enabled without value, incompatible unit, zero/positive threshold, negative/current zero balance, refill unset, already queued for shopping, saving, offline queued, conflict |
| Trial | not enrolled, opted in, dismissed, in progress, complete, stopped, feedback draft prepared; no automatic send |

For every new surface: visible keyboard focus; logical focus order; 44px effective touch targets; Enter/Space activation; labels/errors tied to fields; screen-reader announcements for changes; dialogs trap and restore focus; reduced motion; sticky footer above safe area and software keyboard; 320px and 200% text/zoom checks. Preserve the existing drag-navigation cancellation and keyboard behavior.

The state-coverage script found markers for all eight scanned state terms across 34 source files. It is a lexical scan and proves no per-workflow runtime state. The visual-smoke helper fetched nonempty HTML with HTTP 200; its own screenshots status is `skipped-no-browser-driver`. Actual screenshot evidence came from the separate browser captures.

## Public marketing critique

**ROUND 1 — audit, no fixes applied**

Seen in one second: a large serif kitchen promise and a pale miniature product window.

Idea: a kitchen ledger connects the cook's real stock with the next meal and purchase. The current execution communicates the category but does not make Grocea's exact, traceable loop memorable.

Live thing: none beyond links/anchors; the product preview is static.

Layout words: hero=split / loop=equal columns / capabilities=2×2 rows / offline=boxed split / closing=centered statement / footer=single row.

Scores: design 6.5 · usability 6.5 · creativity 6.0 · content 7.5 → raw 6.5; **overall 6.0 after inspector FAIL cap**. This is the requested taste rubric, not a product-readiness score. The artifact-specific concept also passes broadly for kitchen competitors, so originality is modest.

Top three visible issues:

1. `marketing/tablet-fold.jpg` and `tablet-page-01.jpg`: hero product and capability copy clip at the right; inspector measures 47px sideways overflow. Fix grids/minimum widths and stack at the actual content breakpoint. Do not merely conceal overflow.
2. `marketing/desktop-fold.jpg`, `mobile-fold.jpg`: eight-word hero uses three lines at 68px desktop/44px mobile. Replace with a short product-specific headline such as **“Your kitchen, accounted for.”**, then one direct sentence describing pantry, recipes, and shopping. Keep a visible Create account action.
3. `marketing/desktop-fold.jpg`, all page sheets: product evidence is a tiny illustrative mock with 7–12px details, a leaf ornament, and no real interaction; the remaining sections mostly repeat claims. Replace with 4 readable, explicitly labeled synthetic-demo crops/fragments that show stock → recipe shortage → shopping → activity, accompanied by one concrete explanation each. Do not invent customer proof.

Inspector: **15 FAIL, 4 WARN**. Lint across TSX/CSS: **21 FAIL, 9 WARN**. Machine report: `design/marketing/report.json`; lint text: `design/marketing-lint.txt`. Other flags include eyebrows, decorative numbering/hairlines, resting shadow, tiny labels, a low-contrast decorative recipe caption (1.3:1), lack of picture fragments recognized by inspector, and no measured motion. Its 11px “body” inference is dominated by preview details; the main lead is visibly larger. Product fragments should use `data-ui` only when they are true interface content, never as a blanket escape hatch. Decorative caption should be removed or made readable. Preserve honest first-online-sync prerequisite and real contact/GitHub links.

No fixes/re-inspection round was performed because implementation was explicitly excluded from this study. No score is represented as final design acceptance.

## Proposed marketing direction and copy argument

Real inventory: individual private account; explicit ingredient tracking; metric mass/volume/count; exact balances; recipe readiness against current stock; Basket combines recipe shortages; purchased-to-pantry choice; immutable activity with linked reversals; device-local edits after first sync; account-scoped pending queue; existing chef icon/green brand; open-source repository and actual contact. Available imagery is the app itself with isolated synthetic fixtures; no customer photography, testimonials, or measured benefit metrics.

Argument/proof, in order:

- “Your kitchen, accounted for.” → readable current-stock fragment; Create account.
- “Cook from what you have.” → real recipe readiness/shortage fragment.
- “Keep the next shop connected.” → actual shopping and pantry-completion preview, after standalone shopping ships.
- “Know what changed.” → actual stock/cook activity record with quantities.
- “Keep working offline.” → factual online-first prerequisite and save/sync-state explanation; public promise remains conditional on reliability verification.
- Closing account action + real support/source links. No testimonial, savings, or pricing section without actual content/policy.

Taste exploration command:

```sh
TASTE_SKILL_HISTORY=/tmp/grocea-design-study-history.json node /Users/ammar/.agents/skills/design-taste-frontend/scripts/draw.mjs --sector consumer-app --brief 'Grocea connects exact metric pantry stock, recipe readiness, shopping and traceable cooking for individual home cooks; show the real kitchen loop honestly' --sections showcase,how-it-works,features,cta,footer --tone warm --have product-ui --keep palette,type --options 3 --seed 16102026 --out reports/next-phase/design/direction
```

Three dealt directions: Split stage, One motif, Page is the object. Selected **Page is the object**, seed **16102026**, because the actual kitchen ledger and shopping list can carry Grocea's exact quantity/history story. Full sheet generated with the same arguments minus `--options 3`, plus `--direction page-is-the-object`; saved in `design/direction/` and `design/direction-sheet.txt`. No redraws. This is an exploration artifact, **not** an instruction to copy unrelated restaurant stripes, architecture photographs, receipt times, portrait, or fixed full-screen sections from its generic blueprints. Before a marketing build, replace content-incompatible slots through the skill's explicit alternatives/redraw mechanism and record reasons; retain the ledger concept and brand tokens.

Proposed live thing: a small, clearly labeled example stock-to-shop control using the same quantity rules as the app. A visitor selects one of a few sample pantry amounts and sees an exact recipe shortage and proposed list amount. It never writes account data, needs no sign-in, works by thumb/keyboard, and has a plain static fallback. For a modest product, a short demonstration of the actual mechanism is better evidence than ornamental cooking stock footage. No third-party imagery or video was downloaded or used.

The motion layer, if implemented, should explain the quantity handoff and give control feedback, with reduced-motion fallback. Do not add motion to the operational app solely to meet a marketing inspector count.

## Implementation order and release boundary

1. Close backend/auth/offline/installed-device verification and real regressions; do not interpret this study as that signoff.
2. Implement shopping list creation + restock-to-list with source-aware controls and correct empty states.
3. Implement batch stock and pack entry with a clear review/transaction model.
4. Implement account recovery/data controls with backend support.
5. Add optional threshold/refill settings once direct shopping exists.
6. Add lightweight opt-in trial material and support entry; gather actual feedback before another visual redesign.
7. Rework public page using the shipped product, then repeat taste lint, inspector, screenshot critique, keyboard and 320/390/768/1440 layouts.

**Ran:** local source audit, public taste lint and inspector, browser route screenshots, selected restock interactions, local purchase checkbox toggles and completion/editor previews, actual profile-container scrolling, state-marker scan, HTML smoke check. No shopping completion was submitted. The three detail widths reuse one temporary browser profile, so checkbox toggles alternate purchased/unpurchased state; this explains the different completion previews and is not a data defect. Completion autofocus landed on Cancel at 768/390/320px; full focus-trap/keyboard verification remains pending.

**Skipped:** application edits, deployments, real accounts, remote data/DB writes, production claims, code/build tests (no implementation changed), external media/upload, comprehensive state interaction QA.

**Planned:** targeted workflows above, visible save state improvements, responsive/touch fixes, public product-evidence composition.

**Manual/release gates:** real sign-in/recovery email, PWA install and offline lifecycle, reconnect/cross-device conflicts, account deletion/export completeness, native touch/keyboard/safe area, screen reader, Safari/Android, actual one-week cook feedback. No trial outcome, accessibility certification, or release readiness is claimed.
