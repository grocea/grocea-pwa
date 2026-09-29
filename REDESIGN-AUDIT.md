# Grocea PWA + Marketing Redesign Audit

**Date:** 2026-09-29  
**Target:** `https://grocea-pwa.ammar-jmldn.workers.dev` and the local `grocea-pwa` source  
**Goal:** Establish an evidence-backed redesign brief for the whole PWA and its public marketing page. This is an audit, not an implementation.

## Executive summary

Grocea already has a clear connected workflow in code and live screens: pantry stock informs recipe readiness, recipes form a grocery basket, shopping can update pantry stock, and cooking changes remain traceable in Activity. The app also has a responsive PWA shell, an offline outbox, and useful quantity previews in consequential flows. Preserve those product mechanics and the Kitchen Ledger character.

The redesign should first resolve product clarity and resilience—not just restyle screens:

1. Initial authenticated route snapshots caught the startup splash, but the signed-in app rendered after additional settling; the indefinite boot stall was not reproducible.
2. The pantry currently labels every zero-balance ingredient “Needs restock.” The test account showed 138 such items, while the ingredient model has no explicit tracked/untracked distinction.
3. The marketing page makes unsubstantiated savings and food-waste claims despite the product brief explicitly saying outcomes are not measured.
4. Offline-first messaging should explain the one-time online sign-in/initial-sync requirement. Recipe and shopping quantities also switch between metric units (for example, 0.1 kg in recipe detail and 100 g in the cook preview), so their presentation needs a deliberate unit policy.

**Redesign north star — the Kitchen Loop:** make four jobs unmistakable: **know what is on hand → choose what to cook → shop for what is missing → record cooking and keep stock current.** Keep the mobile PWA highly touchable and offline-aware; keep desktop equally complete, not merely a stretched mobile layout.

## Evidence available

| Surface | Coverage | Evidence and limits |
|---|---|---|
| Public welcome page (`/welcome`) | Desktop 1440×900 and mobile 390×844 | Live DOM snapshots and computed styles; desktop screenshot below. Mobile screenshot capture failed with `UnknownVizError`, so mobile visual claims are limited to inspected DOM, bounds, and source. |
| Sign-in (`/login`) | Live desktop form before authentication | DOM snapshot; the supplied test account signed in successfully. No credentials are included in this report. Registration is source-reviewed only. |
| Pantry (`/pantry`) | Live mobile and desktop | Pantry loaded after the initial splash; snapshots showed live counts and responsive navigation. |
| Recipes and cooking | Live desktop; route interaction | Reviewed the recipe list, Buttermilk Sauce detail, servings-scaled cook preview, and pantry quantity deltas. |
| Groceries and basket | Live desktop and mobile; route interaction | Reviewed empty next-shop state, basket, past list, active list, item check-off, and the completion confirmation with/without Pantry update. Temporary audit data was cleaned up; see privacy notes. |
| More, Profile, Catalog, Categories, Activity, Sync | Live mobile; route interaction | Visually traversed account summary/profile, catalog filters, categories, stock-change history, and sync status/conflict recovery. No password/profile changes were made. |
| Metadata / responsive fetch | Automated | Reports: [`metadata-lint.json`](reports/redesign-audit/metadata-lint.json), [`marketing-smoke/summary.json`](reports/redesign-audit/marketing-smoke/summary.json), [`pwa-smoke/summary.json`](reports/redesign-audit/pwa-smoke/summary.json). The smoke scripts only fetch HTML; they do not render viewports or use the authenticated session. |
| UI state markers | Existing static artifact | [`state-coverage.json`](reports/state-coverage.json) reports markers in 44 files. This is a lexical scan, not proof that runtime states work. |

![Desktop welcome-page first viewport](../.openchamber/screenshots/grocea-marketing-desktop-2026-09-29T04-54-45-946.jpg)

## Severity matrix

| Severity | Finding | Evidence | User impact | Fix direction | Verification |
|---|---|---|---|---|---|
| **P2** | **Startup splash gives no progress or recovery cue while the app settles.** Early live snapshots after re-entry and direct route loads showed only “Your pantry is almost ready” with no controls; after additional settling, Pantry and other routes rendered. A persistent boot failure was not reproduced, so the cause and duration remain unknown. | `DOM`, `source` (`src/app/App.tsx`, `src/app/GroceaProvider.tsx`, `src/shared/ui/GroceaLoadingSplash.tsx`) | A short but opaque delay can look like a dead app, especially when returning to a task or opening offline. | Keep startup bounded and legible: distinguish local storage opening from first sync, show meaningful progress where possible, and expose a non-destructive recovery action only when the relevant operation is actually stuck. | Test cold start, reload, tab return, offline launch, slow storage, first sync, and rejected auth on mobile and desktop. Assert the user reaches content or a specific recoverable state. |
| **P1** | **“Needs restock” conflates zero balance with an intentional restock need.** The pantry computes restock as every ingredient not currently positive and filters zero balances into that tab. `Ingredient` has no tracked/untracked field. The live account displayed **13 in stock · 138 need restock**. | `DOM`, `source` (`src/features/pantry/screens.tsx`, `src/domain/types.ts`) | A large global/custom catalog can look like 138 shopping intentions, burying genuinely depleted staples and weakening confidence in pantry counts. | Decide the domain meaning first. Prefer a distinct “not tracked” state; show “Restock” only for items the cook has chosen to track and depleted. If zero simply means absent, relabel it “Not in stock” and avoid treating it as a shopping list. | Review representative new and depleted items; verify counts, recipe availability, and shopping generation agree with the chosen semantics. |
| **P1** | **Marketing leads with unverified outcomes.** The page says “Better food, less waste,” “Save time, spend less,” “No more duplicate buys,” and “Waste less, gently.” The product brief says no measured savings or waste outcomes have been established. | `screenshot`, `source` (`WelcomePage.tsx`), product context (`PRODUCT.md`) | The promise can overstate what the product has proven and erode trust with an audience that needs a concrete explanation of the workflow. | Lead with observable capabilities: track ingredients, see recipe readiness, plan missing groceries, and keep stock history. Use outcome claims only when supported by evidence. | Copy review against the product brief; check every headline, proof point, and social preview for substantiation. |
| **P2** | **“Offline-first” omits the first-use connectivity boundary.** Public copy promises offline use. Source says an account must first be confirmed by the server, and first sync may block editing until it completes. | `DOM`, `source` (`AuthScreens.tsx`, `MoreScreens.tsx`, `App.tsx`, `public/sw.js`) | A new cook may expect to install and start offline, then encounter a connection gate with no prior context. | Explain the boundary at signup/onboarding: sign in and complete the first sync once; then local changes can be made offline and queued. Keep this distinct from a sync outage after setup. | Fresh-account walkthrough: install → sign in → first sync → offline edit → reconnect; verify copy matches actual gates. |
| **P2** | **The hero’s illustrative data and avatar-like proof are not identified as samples.** The mock kitchen hardcodes 24 in-stock, 3 restock, and a fictional recipe; three colored avatar circles imply people/social proof without attribution. The signed-in account showed different counts. | `screenshot`, `source` (`WelcomePage.tsx`) | Visitors may read fictional values as representative usage or the circles as customer proof; the preview also feels less like the actual operational PWA. | Use a scrubbed, real product screen or label the mock “Sample kitchen.” Replace avatar decoration with verified proof—or with explicit privacy/offline/sync assurances. | Compare the public preview with current product UI at desktop and mobile; ask first-time visitors what the numbers and avatar marks mean. |
| **P2** | **Public metadata is incomplete for sharing and canonicalization.** The metadata lint found a title, description, and H1, but no canonical, Open Graph title/description/image, or Twitter card. The title is only “Grocea.” | `automated`, `source` (`index.html`; [`metadata-lint.json`](reports/redesign-audit/metadata-lint.json)) | Search and social previews have weak page-specific context and may choose an unsuitable preview image or URL. | Add a specific public-page title, canonical URL, Open Graph fields, and social card image. Keep the PWA’s private authenticated routes out of indexation as appropriate. | Re-run metadata lint, inspect rendered head tags on `/welcome`, and validate a real share preview. |
| **P2** | **Measurement preference is presented as fixed Metric.** The profile shows a disabled Metric selector; the domain type only permits `'metric'`. The confirmed product brief says metric-only units are not a decided promise. | `source` (`MoreScreens.tsx`, `domain/types.ts`, `PRODUCT.md`) | A locked control suggests a user preference exists but cannot be changed, and prematurely closes a product decision. | Either remove the disabled setting until decided or model and expose the actual supported preference. Do not promise imperial support until its conversion and persistence behavior is designed. | Confirm the unit policy; check pantry, recipe authoring, shopping, and history for consistent formatting after the decision. |
| **P2** | **PWA orientation is declared portrait-only despite desktop and landscape support being first-class.** The manifest sets `orientation: "portrait-primary"`; the app source otherwise has desktop navigation and wide-screen layouts. | `source` (`public/manifest.webmanifest`, `src/styles/app.css`) | On platforms that honor orientation locking, landscape tablet use may be constrained unnecessarily. | Remove the orientation restriction unless there is a validated device-specific reason. Preserve the compact bottom bar on narrow screens and the side rail/work area on desktop. | Test installed display modes at phone portrait, tablet portrait/landscape, and desktop; check safe areas and keyboard-driven resizing. |
| **P3** | **Groceries appears in both the primary navigation and More.** | `source` (`AppShell.tsx`, `MoreScreens.tsx`) | Duplicate destinations make More less predictable and add noise to the secondary menu. | Keep Groceries in the primary navigation; reserve More for account, catalog, categories, and synchronization. | Re-test navigation labels and destination consistency across mobile and desktop. |
| **P2** | **Quantity units change between recipe and cooking views.** The live Buttermilk Sauce detail showed some available amounts as `0.1 kg` / `0.01 kg`, while the cook preview showed the same amounts as `100 g` / `10 g`; fractional item quantities also appear for ingredients such as onion. | `DOM` (live recipe detail and cook preview), `source` (`src/features/recipes`) | Cooks must mentally normalize units while checking whether the preview is plausible; this is more noticeable when deciding whether Grocea's metric-only policy is intentional. | Decide the supported measurement system, then use a consistent, readable display unit by ingredient and preserve precise canonical amounts underneath. Explain fractional counts where they are valid. | Compare pantry, recipe detail, cook preview, basket, grocery list, and Activity for the same ingredients and serving changes. |
| **P3** | **Past-list dates have ambiguous labels and formats.** A live past-list card showed `10.8.2026` beside `11/08/2026`; its detail view also showed both values without explaining whether they mean created versus completed. | `DOM` (live grocery history card and detail) | A cook cannot tell at a glance whether the dates are different lifecycle events or inconsistent formatting. | Label dates by meaning (for example, created and completed) and use one locale format consistently. Confirm the values are intentionally distinct before treating this as a date-calculation defect. | Check lists created and completed on different days, same-day completion, and dates near timezone boundaries on mobile and desktop. |

### Implementation risk (source-only)

`src/styles/app.css` imports `legacy.css` and has layered responsive rules; `.pantry-content` is assigned a wide-screen grid near line 533 and later reset to `display: block` near line 1811. This is not by itself proof of a rendered defect, but it raises regression risk during a broad redesign. Consolidate the responsive shell/tokens and remove superseded overrides as screens are rebuilt, rather than stacking another stylesheet layer.

## Screen-by-screen redesign brief

- **Pantry:** Make the inventory model legible before adding decoration. Separate “tracked and depleted” from “not in my pantry”; surface the next useful action without making a large catalog look like a shopping list. Keep search/category filtering and fast stock adjustment. On mobile, protect the first useful rows from the fixed navigation; on desktop, use the extra width for comparison, not oversized cards.
- **Recipes:** Keep explicit readiness and missing-ingredient counts. Give “cook,” “add to grocery plan,” and “customize” distinct hierarchy. Preserve servings scaling and the ability to cook with a disclosed shortfall.
- **Recipe authoring:** Preserve the five-step progress model and autosave, but make draft status, validation, and “save and exit” behavior unmistakable. Keep ingredient amounts and measurement units together at narrow widths.
- **Groceries:** Make the active list a focused shopping mode: large check targets, clear purchased/remaining progress, easy edits, and an explicit completion review before checked items update pantry stock. Keep generated amounts traceable to the recipes that produced them.
- **Cooking and Activity:** Preserve before → change → after quantities and immutable history. Make reversal a deliberate, explained action that never silently rewrites later events.
- **More, Profile, Catalog, Categories, Sync:** Separate account settings from ingredient-management tools. Treat offline/pending/failed states as understandable user states, not merely icons; keep retry/discard language explicit and explain consequences before destructive actions.
- **Marketing:** Rebuild the narrative around the kitchen loop, show a genuine product surface early, use clearly marked sample data, and keep one dominant account-creation CTA. A PWA/install and offline explanation should say what works offline and what must happen once online.

## Design and platform contract

- **PWA-first; desktop is first-class.** Mobile gets touch-sized controls, safe-area-aware fixed navigation, and offline status. Desktop gets the full workflow in a stable side rail and work area—not a mobile view enlarged to fill the screen.
- **Retain “The Kitchen Ledger”**: warm paper, deep evergreen structure, lime only for meaningful actions/selection, flat operational rows, and a more editorial marketing register. The redesign should improve meaning and hierarchy rather than flatten Grocea into a generic SaaS dashboard.
- Keep privacy by personal account, offline continuity after setup, exact quantities, and traceable stock history. Household sharing remains undecided; metric-only measurement and explicit pantry tracking are confirmed.

## Ran

- Inspected the live welcome page at desktop and mobile and signed in using the user-authorized test account.
- Traversed signed-in Pantry, recipe list/detail/cook preview, grocery index/basket/past and active lists/completion confirmation, Activity, More, Profile, ingredient catalog, Categories, and synchronization at mobile and/or desktop sizes. Evidence is live DOM and interaction snapshots; only selected surfaces have screenshot captures.
- The initial re-entry snapshots caught the loading splash; later snapshots after additional settling rendered the app. No indefinite startup failure was established.
- Ran the marketing metadata lint: 100 files scanned; missing canonical and social metadata reported.
- Ran public-page and `/pantry` HTML smoke fetches: both returned HTTP 200 with non-empty HTML. These checks do **not** validate authenticated rendering.
- Reviewed the existing state-marker report; all listed markers were found, but the check is lexical only.

## Skipped / residual risk

- Automated browser-driver screenshots for the smoke scripts: the scripts report `skipped-no-browser-driver`; live browser snapshots and selected live captures are separate from those smoke scripts.
- Offline/airplane-mode behavior, installability, keyboard-only and screen-reader flows, accessibility tooling, Lighthouse/performance, cross-browser behavior, and registration remain untested live. No Lighthouse or axe scores, or accessibility issue counts, are claimed.

## Privacy notes

The user explicitly authorized sign-in and exploration at the supplied deployment. The report contains no credentials, email address, or personal pantry details. The desktop screenshot is limited to the public marketing page.

For shopping-flow inspection, a temporary grocery list was created and deleted. A cheese item was checked and then unchecked before completion, so Pantry was not updated. Basket servings were changed during the walkthrough and restored to 2 for each of the original two recipes. The app then showed the original two past lists, no active grocery list, `Synced`, and `IDLE` with 0 queued changes. No pantry stock, recipe, profile, password, or account settings were intentionally changed.

## Redesign implementation follow-up — 2026-09-29

### Product decisions applied

- Pantry tracking is explicit: only tracked zero-balance items appear in “Needs restock.” Catalog items remain untracked until chosen. Stopping tracking is allowed only at a zero balance, so live stock is not silently discarded.
- Measurements are metric-only. The disabled profile selector is removed, recipe detail and draft review normalize to the same readable family-based metric display as cooking/pantry/shopping/history, and fractional count amounts are explained as partial ingredients.

### Delivered

- Added account-scoped, idempotent `PUT /api/pantry-stocks/{ingredient_id}/tracking`; it creates/removes zero-balance pantry rows without fabricating stock-activity events. Local state, offline mutations, persistence normalization, and local-state import now preserve tracking explicitly.
- Reworked Pantry and Ingredient catalog actions/counts around tracked versus untracked ingredients; removed duplicate Groceries navigation from More and clarified first-sync/offline requirements.
- Rebuilt the public welcome page around the kitchen loop with explicitly labeled sample quantities, removed unverified savings/waste claims and decorative social proof, added an original 1200×630 social card, canonical/Open Graph/Twitter metadata, and noindex metadata for private app routes.
- Removed the portrait-only manifest declaration; aligned the app surfaces with the flat Kitchen Ledger palette; gave completed grocery lists a consistent, labeled completion date.

### Verification and remaining evidence limits

- PWA production build, changed-file ESLint, backend Ruff, and backend Python compilation passed. The generated OpenAPI contract includes the tracking route.
- Metadata lint and lexical state-coverage checks passed. Marketing and webapp smoke scripts returned HTTP 200; automated screenshots were skipped because no browser driver is installed.
- Manually checked the local marketing page in the browser at 1440×900 and 390×844; the mobile viewport showed no body-width overflow. The redesigned authenticated routes were not visually traversed locally because this browser profile has no local authenticated session.
- No production deploy was performed. Installed-PWA, airplane-mode/reconnect, cross-browser, keyboard-only, screen-reader, Lighthouse, and axe validation remain outstanding. The earlier startup splash settled normally during the live audit; no persistent stall was reproduced or independently changed in this implementation phase.
