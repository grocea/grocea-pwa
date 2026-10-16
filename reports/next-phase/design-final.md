# D1 public welcome design verification

2026-10-16 · branch `codex/grocea-d1-welcome` · implementation base T06 `781eceb` · local Chromium, synthetic development-demo image capture, production-build final verification. No deployment, remote account data, external media or backend changes.

## Result

The welcome page now presents one paper kitchen ledger: actual stock, an exact recipe shortage example, shopping and recorded cooking. Signup is the single filled action on the first screen. The original chef mark, Georgia/Inter, green/oat palette, real account/support/source links and exact footer are retained: **© 2026 Grocea. Open source under the MIT licence.** Signed-in app styling/navigation is untouched.

Implemented files: `src/features/marketing/WelcomePage.tsx`, `welcome.css`, `index.html`, and four PNG files under `public/images/welcome/`. `index.html` retains the public canonical/social-image contracts, updates title/social titles, and supplies a real static noscript summary, default arithmetic and explicit JavaScript requirement. JSX defaults alone were never treated as a no-script fallback.

## Direction and copy

**The page is the object**, seed **16102026**, palette/type kept. Preparation and full copy/claim-proof argument: [PUBLIC-DESIGN-PREPARATION.md](../../docs/next-phase/PUBLIC-DESIGN-PREPARATION.md). Exact redraw record and artifacts: [direction-sheet.txt](../../docs/next-phase/design-preparation/direction-sheet.txt).

Final slots: Invitation card, cropped → Live demo with controls → Photographs down a diagonal → Capabilities as a menu → A plain sentence, one action → Contact as the headline. The preparation documents six redraw operations, including the rejected intermediate pinned-fragment section. Reasons were missing restaurant/photography/timetable content and the requirement for actual product crops. No direction, palette or type redraw occurred.

The invitation geometry becomes a straight-edged ledger sheet, without wedding ornaments. Phone content uses natural height; essential copy/signup is never clipped. The live-demo blueprint has one meaningful radio group instead of invented extra controls. Diagonal crops stack at readable full width on phones. The conditions sheet uses factual paragraphs rather than invented prices. The footer uses readable contact text rather than a giant email that breaks the headline rule. No new redraw was needed during implementation.

Idea: Grocea's exact pantry balances, recipe shortages, purchases and immutable stock changes become entries in one kitchen ledger. The broad ledger metaphor is familiar; the exact product sequence and interactive shortage make the page specific. Live thing: choose0/2/3 tomatoes on hand and see shortage3/1/0 for the actual two-serving Tomato egg rice fixture. Native radio semantics provide keyboard and thumb access; a polite live result announces changes. This local illustration has no account writes or fake list-creation button.

## Actual image provenance

Capture script: [capture-sample.mjs](design-final/capture-sample.mjs). Captured labels/quantities, selectors and CSS bounds: [crop-provenance.json](design-final/crop-provenance.json). All source images are actual running local development-demo app regions, captured at320 CSSpx viewport and device scale factor3, with no retouching, invented balances or real account content. The four production assets are self-hosted PNGs. Existing chef assets remain unchanged. No external image licence/credit is required; the visible captions identify the sample kitchen.

The source fixture is `src/app/fixtures.ts`: Tomato egg rice, two servings,300g Basmati rice,2 eggs,3 tomatoes. Initial stock is2.4kg rice,8 eggs,2 tomatoes. Canonical quantity precision remains the app's1000 units per displayed g/item. Actual demo actions added1 tomato to the existing shopping list, marked it purchased, selected pantry completion (tomatoes2→3), then recorded two servings (rice2.4→2.1kg, eggs8→6, tomatoes3→0). The shopping crop also includes the fixture's existing carrots2; no claim is made that those carrots belong to this recipe. The marketing radio example is independent of these captured transactions.

| Asset | Actual raster dimensions | Native CSS region | Visible evidence |
| --- | --- | --- | --- |
| pantry.png | 852×324 | 284×108 | Tomatoes2 items |
| recipe.png | 852×927 | 284×309 | Needed300g rice,2 eggs,3 tomatoes; shortage1 tomato |
| shopping.png | 864×609 | 288×203 | Carrots2 and tomatoes1 to buy |
| activity.png | 852×864 | 284×288 | Actual cooking before/after and deductions |

Image width/height attributes preserve these ratios before loading. The hero crop is eager; lower crops are lazy. Primary source ingredient text is16px. Measured rendered equivalents are below; secondary genuine UI metadata is smaller than primary text and was not fabricated or restyled.

## Commands and verification

Ran from the assigned worktree:

- `npm run dev:demo -- --host 127.0.0.1 --port 5184 --strictPort` for isolated image capture only; initial sandbox bind failed with EPERM, authorized loopback escalation succeeded. Listener81325 was stopped before production verification.
- `node reports/next-phase/design-final/capture-sample.mjs` for actual demo interactions and DPR3 crops. Initial capture harness incorrectly selected a custom-item field as a catalog select; corrected the harness to choose Catalog. No application defect or account writes resulted.
- `npm run build` passed, including the final noscript-only adjustment. Existing Vite warning: JS chunk581.47kB before gzip exceeds500kB guidance. No framework/code-splitting change is warranted in this contained task.
- `npx eslint src/features/marketing/WelcomePage.tsx` passed.
- `node /Users/ammar/.agents/skills/design-taste-frontend/scripts/lint.mjs src/features/marketing/WelcomePage.tsx src/features/marketing/welcome.css`: **0 FAIL,1 WARN**. Inter warning is the explicitly retained brand face.
- `python3 tools/serve-local-build.py --port 5184`: production fixture listener83736. No demo mode is present in the inspected production page.
- Taste inspector rounds1 and2: `node /Users/ammar/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:5184/welcome --out reports/next-phase/design-final/round-2 --widths 1440,768,390`. Final: **0 FAIL,2 WARN**. Brand cream/oat is intentionally retained; no footage is supplied because no honest clip proves the exact stock mechanism better than these actual interface states. No external stock video was fetched. [Machine report](design-final/round-2/report.json).
- `node reports/next-phase/design-final/verify-welcome.mjs`: actual production browser checks at320/390/768/1440; [results](design-final/browser-results.json). Verified allh1–h3≤2lines, no document/nested horizontal overflow, loaded Inter with computed Georgia display, correct exact results using native ArrowRight keys including wraparound, reduced-motion animation removal, contact/top anchors, actual signup/login routes, exact footer, and real JavaScript-disabled fallback at each width. The current whole-app bundle serves the page, but no development-demo badge exists.
- `node reports/next-phase/design-final/verify-noscript.mjs`: final focused JavaScript-disabled fallback check after shortening its heading; [results](design-final/noscript-results.json). All four widths have a two-line heading, no horizontal overflow, sample3−2=1 and explicit JavaScript requirement.

| Viewport | H1 size/lines | Document width | Full PNG dimensions | Primary crop text equivalent minimum |
| --- | --- | --- | --- | --- |
| 320 | 36px /2 | 320 | 320×5212 | 16px |
| 390 | 39px /2 | 390 | 390×5062 | 19.89px |
| 768 | 41.472px /2 | 768 | 768×4739 | 16.73px |
| 1440 | 72px /2 | 1440 | 1440×5472 | 24.06px |

Every measured heading remains≤2lines; nested-overflow arrays are empty. FontFaceSet confirms loaded Inter; computed h1/h2 family is Georgia with system serif fallback. Source type scale uses five editorial roles; retained24px wordmark is a brand exception outside that scale. Native radios have48px label targets and explicit visible focus styles. The fixed500kB bundle warning is unrelated to this public layout repair.

## Look/fix rounds and critique

**Round1, development:** opened every generated fold/contact sheet. Clear ledger concept and exact demonstration, but low-DPR pantry raster was visibly soft and its large multi-group region extended the hero unnecessarily.320 inspection output also had a200px viewport and colliding `mobile-*` filenames; it was not accepted as phone evidence. Corrections: DPR3 images, focused tomato-only pantry crop, actual image aspect attributes, coherent actual cooking record, phone crops at native readable width, and explicit independent four-width production captures.

**Round2, production:** viewed folds320/390/768/1440, full-page320/768/1440 and no-script320; root independently reviewed production folds1440/390/320, no-script390, lower layout, source and metrics. First glance: the two-line ledger headline and one signup action. Type has a clear display/body jump; colours stay within the existing brand. Hero card, live calculation, diagonal proof, conditions sheet and contact close vary their geometry without icon-card filler. Every crop has a concrete proof role. Phone uses its own stacked controls/crops; no collisions or clipped content appear. The footer and offline prerequisite are complete and truthful.

Final editorial rubric: **design7.5, usability8, creativity7, content8.5; weighted7.65/10**. This is a subjective design critique, not a product-readiness score or external jury result. Remaining softness: the ledger metaphor is familiar, and the desktop pantry row is intentionally enlarged relative to normal app use. Four real images and the exact interaction provide substance; no extra decorative motion/video is needed. Motion uses modest transform/opacity entry and control feedback, keeps initial content visible, and disables travel for reduced motion.

Two actual look/fix rounds total. The final no-script heading change received a focused fallback check only, not a redundant broad suite.

## Evidence and limits

Selected final artifacts: [phone320](design-final/fold-320.png), [phone390](design-final/fold-390.png), [tablet](design-final/fold-768.png), [desktop](design-final/fold-1440.png), [full phone](design-final/full-320.png), [full tablet](design-final/full-768.png), [full desktop](design-final/full-1440.png), [no script](design-final/noscript-320.png).

True full-page PNGs explicitly expand the viewport to the measured document height before Page.captureScreenshot with captureBeyondViewport/clip, then restore it. PNG dimensions were checked; these are not viewport screenshots mislabeled full-page. Taste contact sheets remain supplemental evidence.

No deployment, remote service/DB writes, private account captures, external uploads, marketing benefits/customer proof or production reliability claims. D1 does not close T01 sync-race/offline verification, physical installed-device/touch/safe-area checks, Safari/Android or screen-reader/200% browser-text-zoom review. Automated keyboard radio checks are narrower than a complete assistive-technology audit. Root owns statuses, OpenWolf lifecycle, final commit/push and subsequent T01 work. Source is frozen after root's approved round2 and final no-script correction.

Final lifecycle: development listener81325 and production listener83736 were stopped; port5184 was confirmed free. Root approved source/production round2. Branch packaging/push follows the user’s existing authorization; no PR or deployment.
