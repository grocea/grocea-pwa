# D1 public welcome preparation

Prepared 2026-10-16. Documentation and direction artifacts only. Application implementation awaits root's final post-T06 worktree. No application source, browser runtime, Git, database, or server state changed.

## Decisions

Use **The page is the object**, seed **16102026**, with existing Grocea Georgia/Inter typography, welcome palette, and currently shipped chef logo. No logo redesign or new font. On this page, **Grocea's exact pantry balances, recipe shortages, purchases and immutable stock changes become the entries of one kitchen ledger**. This concept is grounded in the actual product; the broad ledger metaphor alone is not claimed to be unique to Grocea.

Audience: individual home cooks deciding whether to create an account. First-screen belief: Grocea connects what is in the pantry with what a recipe needs and what to buy. Proof: legible actual app crops and one exact, isolated example. Primary action everywhere: **Create account**. Sign in is a plain link. No pricing, savings, waste reduction, customer counts, testimonial or research claims.

Follow the current [design-taste-frontend skill](/Users/ammar/.agents/skills/design-taste-frontend/SKILL.md). Existing-project guidance contributes scoped changes, existing stack and working behavior; where its ornament/font suggestions conflict, this explicitly invoked taste skill and retained brand govern. Public rules never apply to the signed-in glass navigation.

## Subject inventory

- Personal private kitchen accounts; no shared-household claim.
- Explicit ingredient tracking, distinct from merely being in the catalog.
- Exact metric mass, volume and item counts; readable g/kg and ml/L scales.
- Basmati rice, eggs and tomatoes in the actual local fixtures.
- Tomato egg rice: two servings, 300 g rice, two eggs, three tomatoes.
- Fixture pantry has 2.4 kg rice, eight eggs and two tomatoes.
- Recipe shortages flow into a shopping list through Basket.
- Shopping can start independently and accept restock items after the shipped shopping changes.
- Purchase completion previews the stock addition before applying it.
- Recorded cooking changes stock with traceable activity and linked reversals.
- Offline work follows successful online sign-in and first sync.
- Existing chef mascot, evergreen/oat palette, real source repository and support email.

## Claim → proof argument

| Position | Claim | Actual proof to capture/build |
| --- | --- | --- |
| Hero | Your kitchen, accounted for | Readable pantry crop with exact rice/egg/tomato balances; account action |
| Showcase | See what is missing | Fixture-backed tomato quantity control and exact shortage; recipe crop |
| Kitchen loop | Keep the next shop connected | Actual shopping-list/completion crop and the exact proposed tomato amount |
| Kitchen loop | Know what changed | Actual activity crop showing ingredient, before/change/after quantities |
| Working conditions | Offline after first sync | Plain prerequisite and save/reconnect explanation; no unverified screenshot badge |
| Close | Start with your own pantry | Real account destination; contact/source footer |

No section exists merely to fill a template. Stock → shortage → purchase → history is the page's reading order. Workflow explanations describe product mechanics, not measured outcomes.

## Complete copy deck

Navigation: existing logo; **Kitchen loop** → #kitchen-loop; **Offline & privacy** → #offline-privacy; **Contact** → #contact; **Sign in** → existing login route. Keep signup as the single dominant filled action on the first screen: either in the hero card or navigation, never both visible as competing buttons.

Hero headline: **Your kitchen, accounted for**

Supporting sentence: **Grocea connects your pantry stock, recipe needs, shopping lists and cooking records in one personal kitchen.**

Primary button: **Create account** → existing signup route.

Secondary text link: **Explore the kitchen loop** → #kitchen-loop.

Visible crop caption: **Sample kitchen. Actual Grocea screens with example ingredients and quantities.**

Showcase heading: **See what is missing**

Supporting sentence: **Change the tomatoes on hand to see what Tomato egg rice needs for two servings.**

Demonstration contents:

- **Tomato egg rice**
- **2 servings**
- **Recipe needs: 300 g Basmati rice, 2 eggs and 3 tomatoes.**
- **Pantry has: 2.4 kg Basmati rice and 8 eggs.**
- Field label: **Tomatoes on hand**
- Radio choices: **0 tomatoes**, **2 tomatoes**, **3 tomatoes**. Default: 2 tomatoes.
- Default result: **Buy 1 tomato**
- Default explanation: **3 needed − 2 on hand = 1 for the shopping list.**
- Zero-stock result: **Buy 3 tomatoes** / **3 needed − 0 on hand = 3 for the shopping list.**
- Ready result: **No tomatoes to buy** / **3 needed − 3 on hand = 0 for the shopping list.**
- Persistent note: **Sample kitchen. This example does not change your pantry or create a shopping list.**

Kitchen-loop heading: **From pantry to plate**

Recipe caption and paragraph: **Check a recipe.** Grocea compares its ingredients with current pantry stock. In this sample kitchen, Tomato egg rice is short of one tomato.

Shopping caption and paragraph: **Buy what is missing.** Add recipe shortages or restock items to a shopping list, or start a list yourself. Review purchased quantities before adding them to the pantry.

Activity caption and paragraph: **Keep the record.** Recording a meal changes pantry stock. Activity shows which ingredients changed, by how much, and their resulting balances.

Working-conditions heading: **Offline after first sync**

Two plain groups on one ledger sheet:

**On your device**

- **Start online.** Sign in and complete the first sync before relying on offline access.
- **Keep working.** After first sync, pantry, recipe, shopping and cooking changes can be saved on your device while offline.
- **Reconnect.** Pending changes synchronize when the service is available. Check the app's save and sync status.

**Your personal kitchen**

- **Private account.** Your kitchen data belongs to your personal account.
- **Exact quantities.** Grocea uses metric measurements and item counts throughout the kitchen loop.

Release caveat for implementer: retain these offline mechanics only within the verified product boundary; D1 visual review is not reliability signoff. Do not write “always saved”, “instant sync”, “works everywhere”, or a data-encryption guarantee.

Closing sentence: **Create your account and start with the ingredients you have.**

Primary button: **Create account**. Secondary link: **Sign in**.

Footer contact heading: **Get in touch**

Contact link: **grocea@aeyslo.lol** → mailto:grocea@aeyslo.lol.

Source link: **GitHub** → https://github.com/grocea/grocea-pwa.

Back-to-top link: **Back to top**.

Exact footer: **© 2026 Grocea. Open source under the MIT licence.**

Do not invent legal-policy URLs or a price/free-plan claim.

## Fixture and interaction contract

Source read: `/Users/ammar/Documents/Grocea/.worktrees/05-restock/grocea-pwa/src/app/fixtures.ts`, `tomato-egg-rice`, `baseServings: 2`. Canonical fixture values: rice300_000n g, eggs2_000n item, tomatoes3_000n item; pantry rice2_400_000n, eggs8_000n, tomatoes2_000n. Existing quantity precision is1000 canonical units per displayed g/item. Confirm against the final assigned worktree before implementing; never silently substitute a different recipe.

The example varies only tomatoes, using `max(0, required − available)`. Rice and eggs remain sufficient in all three cases. Use integer quantities; do not use the browser example to write app/account data. Native radio inputs in a fieldset with legend provide Tab/arrow-key/Space support and at least44px effective targets; visually selected state must not rely on colour alone. Result is a polite live region. No slider precision or drag-only control. Keep the default arithmetic/result in initial markup; without JS the complete default sample remains readable. No fake “Add to list” button in marketing.

## Explicit direction changes

Copied the previously selected direction JSON into [design-preparation/direction.json](design-preparation/direction.json). Palette/type and direction were never redrawn. Current complete output: [direction-sheet.txt](design-preparation/direction-sheet.txt). Six recorded redraw operations, including one rejected intermediate section choice:

| Slot | Original | Final | Content/asset reason |
| --- | --- | --- | --- |
| Hero | Striped card beside the room | Invitation card, cropped (`--redraw hero`) | No room photograph or Grocea stripe exists; the redraw gives a single paper object on a flat field |
| Showcase | Square plate, spare text | Live demo with controls | There are no product editions/tabs or two purchase actions; the exact sample needs one quantity choice and one result |
| How it works | Itinerary on a slip | Photographs down a diagonal | No event timetable/times; three actual product stages need three readable crops |
| Features | Stacking colour sheets | Capabilities as a menu | Offline/private/metric conditions are concise statements, not3–5 giant interactive capability panels |
| CTA | Three photographs, then a field | A plain sentence, one action | No three new photographs and no embedded registration form are supplied; the real destination is signup |

Intermediate how-it-works redraw selected “Pinned fragment, changing state”, then was explicitly replaced because it requires rebuilt changing-state UI rather than the requested actual screenshot evidence. This is a content incompatibility, not a preference redraw. The failed `--alternatives hero` read command has no hero-alternatives support and made no changes; the documented `--redraw hero` was used.

Implementation mapping and constraints override generic blueprint specifics:

- Hero portrait ledger holds the short title, support/action and lower pantry crop. Crop the lower sheet/media to suggest continuation, never the signup or essential sentence. Use a natural-height mobile sheet; no fixed viewport clipping. Remove wedding names, dates, diamonds, italics and decorative scallops; they have no Grocea source and violate house rules. This is a straight-edged ledger sheet, not a wedding invitation.
- Showcase keeps filled-panel input/result proportions, with **one** control rather than inventing six to nine controls. Phone stacks result and radio choices. Use natural content height, not empty15vh spacers on a narrow screen.
- Diagonal stage geometry uses **three real app crops**, not photographs of food. Crop widths must allow reading at native equivalent size. On phones use full available readable width for every crop where62%/78% would shrink text; retain the stagger through text/image offsets only when space permits. No crop may cut the quantity supporting its claim.
- Menu sheet has no fake prices, “included” badges or invented capabilities. Use short paragraphs at16px minimum and semantic lists; no dot leaders or decorative tear-offs.
- Footer retains contact/source/licence, but email is a normal readable link below **Get in touch** rather than an oversized heading that wraps more than twice. Avoid an empty90svh footer.
- Architecture photos are optional and unused: they have no evidence role. Existing software “no screenshots” boilerplate in the raw direction sheet is stale; actual interface screenshots do exist and **four fresh ones will be captured later**. No downloaded media, generated art, fake mock UI or device frames.
- Retain the slow-crossfade signature only as restrained image/entry treatment without hiding content. Never crossfade distinct arithmetic results into unreadability. Add meaningful control feedback, modest section entry travel and reduced-motion fallback; no operational-app motion changes.

## Asset plan, not a claim of existing assets

Four fresh raster crops must be captured in the final implementation worktree from isolated synthetic sample data. Existing audit screenshots are baseline evidence, not the finished assets.

| Planned asset | Required content and caption | Planned placement |
| --- | --- | --- |
| Pantry crop | Basmati rice2.4kg, eggs8, tomatoes2; retain readable ingredient and balance columns | Hero ledger lower panel |
| Recipe crop | Tomato egg rice,2 servings,3 tomatoes required and1 short, plus sufficient rice/eggs | Showcase/first diagonal stage |
| Shopping crop | Actual generated list or completion preview with tomato1; capture coherent sample state after fixture-driven interactions | Second diagonal stage |
| Activity crop | Actual stock/cooking activity with readable before/change/after; if using fixture rice addition, show1.4kg +1kg =2.4kg and explain it as that separate example | Third diagonal stage |

Prefer a coherent tomato loop (buy1 → tomatoes3 → cook2 servings → tomatoes0) if actual sample interactions permit reliable capture. Never retouch quantities to imply coherence. Otherwise caption each independent real sample honestly. No real account names, emails, IDs or private kitchens. Alt text describes the meaningful state and quantities. Add explicit image width/height, avoid lazy loading hero, lazy load below fold. Capture at sufficient resolution so display text is16px-equivalent; crop the useful region instead of shrinking a whole desktop screenshot. The actual file paths and dimensions are pending implementation.

## Responsive and verification handoff

Five public text sizes maximum; Georgia display and Inter body/control. Warm welcome cream ground, welcome ink text, welcome green primary action, mint sheet tonal separation. Preserve current logo and existing button shape as brand continuity; no resting shadow, decorative border, glass, gradient, eyebrow, numbered steps or feature-card grid.

Headline arithmetic for320px with16px gutters:288px/(36px×0.5)≈16 characters/line. Hero has26 characters; authored break after “kitchen,” gives13/12 characters.390px with20px gutters and44px type yields≈15.9 characters/line. At768px use at least560px available ledger measure with56px type (≈20/line); at1440px a560px ledger measure with64px type gives≈17.5/line. These are planning estimates, not verified font measurements. Keep “Your kitchen,” / “accounted for” on at most two lines; shorten or widen before shrinking. Section titles are24 characters or less, except “Offline after first sync” at24; allow two lines at320px.

At tablet stack before content begins to clip (initial proposal900px, verify actual content). Every grid child uses `min-width:0`; no oversized fixed preview. Measure document and nested scroll widths, not just hidden-overflow output. Keyboard focus, all anchors/actions, radio state,200% zoom, reduced motion and no-script readable fallback remain implementation gates.

Baseline reviewed: [tablet-fold.jpg](../../reports/next-phase/design/marketing/tablet-fold.jpg) visually confirms clipped preview and three-line title; prior audit/lint/inspection are in [DESIGN-STUDY.md](DESIGN-STUDY.md). No new build/lint/browser inspection, visual score, final crops or runtime verification is claimed by this preparation. Root owns plan/OpenWolf lifecycle updates. Implementation must run build, focused ESLint, taste lint/inspect, screenshot critique at1440/768/390 plus320, and record actual remaining warnings and exceptions.
