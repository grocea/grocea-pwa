# Product

<!-- impeccable:product-schema 1 -->

## Platform

Installable web PWA; prioritize the PWA use context while treating desktop as a first-class supported surface.

## Users

Individual home cooks managing a home kitchen.

## Product Purpose

Grocea connects pantry tracking, recipe planning, grocery shopping, and cooking in one kitchen workflow. A cook can see what is on hand, find recipes that use it, plan purchases around what is missing, and record cooking so pantry stock stays current.

## Positioning

Grocea's central mechanism is a connected kitchen loop: current pantry stock informs recipe readiness and grocery needs, and recorded cooking updates stock with a traceable history. Its promise is the continuity of that workflow, not any unverified claim about measured savings or waste reduction.

## Operating Context

An individual cook uses Grocea to manage ingredients at home, decide what to cook from available stock, prepare a focused shopping list, and keep the pantry current after cooking or shopping. Grocea is an offline-first web app; changes synchronize when the service is available.

## Capabilities and Constraints

- Kitchen data is private to each personal account.
- Users can continue working offline; changes synchronize when service returns.
- Cooking and stock changes have an exact, traceable activity history.
- Whether household members will collaborate on shared pantry or recipe data is undecided. Do not assume shared-household functionality or rule it out as a future direction.

## Confirmed Product Policies

- **Pantry tracking is explicit.** Catalog membership does not imply a restock intention. An ingredient is tracked only when the cook adds or explicitly tracks it in their pantry; a tracked ingredient at or below zero is depleted and needs restock. An optional account-specific threshold also marks a positive balance at or below that threshold as running low. Untracked catalog ingredients do not imply shopping intent. A saved refill quantity is a fixed proposed purchase, not a subtraction from current balance.
- **Measurements are metric-only.** Do not expose a user-selectable measurement-system preference. Keep precise canonical quantities and format metric values in readable scales (for example, g/kg and ml/l), retaining count units where the ingredient is measured by item.

## Evidence on Hand

- The existing PWA implements pantry and ingredient catalog, recipe readiness, grocery-list planning, cooking records, and account-scoped synchronization.
- The project contains marketing copy and sample recipe cards, but no user research, testimonials, or measured outcome data was established during this setup. Do not present sample content or unmeasured food-waste or savings benefits as validated evidence.

## Product Principles

1. Keep pantry, recipes, shopping, and cooking connected as one workflow.
2. Keep account data private and useful when offline.
3. Make stock changes traceable to the activity that caused them.

## Implemented next-phase capabilities

Standalone shopping lists preserve the recipe Basket. Catalog or free-text items can be added, purchased items checked, and selected purchased catalog quantities added to Pantry during completion. Recipe-generated shopping remains available. Bulk Pantry review supports exact metric Add/Set amounts and packs, then saves one atomic event; its activity history remains immutable. Per-ingredient thresholds and optional refill quantities are private to the account.

Recovery uses standard SMTP and expiring single-use links; acceptance does not promise inbox delivery. Profile exports server JSON with an explicit exclusion warning if local work remains, and permits current-password account deletion with account-scoped same-browser cleanup. Other devices and downloaded files may retain copies.

The optional one-week journal is off by default, stays in this browser, and records only eligible server-acknowledged outcomes plus actual foreground return dates and participant notes. It can stop, export or clear independently. It does not imply a completed participant study or measured savings.

Authenticated offline use requires a complete production app download and successful first sync. Updates wait until old Grocea tabs close; reopening adopts the downloaded build without clearing queued changes. Public shell files are separately versioned and content-validated; account data remains in account-scoped IndexedDB. Browser storage eviction or clearing can remove offline availability. The prior fixed-cache worker requires one close-all-tabs/reopen transition before the new coherent-shell contract applies; legacy open clients cannot be retroactively repaired. Physical installed-device and hosted-release checks remain pending.
