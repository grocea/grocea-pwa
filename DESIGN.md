---
name: Grocea
description: The Kitchen Ledger — a clear, tactile pantry-to-meal workflow.
colors:
  ledger-green: "#254F3A"
  ledger-deep: "#193B2B"
  pantry-lime: "#D9FF82"
  leaf-wash: "#E4F0E7"
  ledger-ink: "#15271D"
  muted-sage: "#526158"
  quiet-sage: "#607067"
  warm-oat: "#F4F2EA"
  porcelain: "#FFFEFA"
  paper-white: "#FFFFFF"
  fine-line: "#DCE1DA"
  restock-amber: "#8A4B20"
  restock-wash: "#FFF0DF"
  danger-rust: "#A13F34"
  welcome-green: "#285640"
  welcome-deep: "#1E4030"
  welcome-mint: "#E7EEE3"
  welcome-cream: "#F4F2E9"
  welcome-ink: "#173528"
  welcome-muted: "#5F6F64"
  pwa-olive: "#254F3A"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(48px, 5.2vw, 76px)"
    fontWeight: 700
    lineHeight: "0.94"
    letterSpacing: "-0.06em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 4vw, 48px)"
    fontWeight: 700
    lineHeight: "0.98"
    letterSpacing: "-0.055em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "1.2"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.55"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.11em"
  button:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 750
  marketing-button:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 750
rounded:
  field: "8px"
  control: "9px"
  card: "10px"
  panel: "10px"
  feature: "12px"
  pill: "999px"
  welcome-button: "8px"
spacing:
  page-gutter: "clamp(18px, 4vw, 56px)"
  field-inset: "12px"
  card-inset: "16px"
  section-gap: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.paper-white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "46px"
  field:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "46px"
  stock-card:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  welcome-primary:
    backgroundColor: "{colors.welcome-green}"
    textColor: "{colors.paper-white}"
    typography: "{typography.marketing-button}"
    rounded: "{rounded.welcome-button}"
    padding: "0 20px"
    height: "50px"
  nav-active-desktop:
    backgroundColor: "{colors.leaf-wash}"
    textColor: "{colors.ledger-deep}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "52px"
  nav-active-mobile:
    backgroundColor: "{colors.leaf-wash}"
    textColor: "{colors.ledger-green}"
    rounded: "12px"
    height: "56px"
---

# Design System: Grocea

## Overview

**Creative North Star: "The Kitchen Ledger"**

Grocea's signed-in experience is a warm, precise kitchen tool: pantry quantities, recipe readiness, and shopping decisions should be quick to scan and easy to act on. Evergreen structure, warm paper surfaces, quiet leaf-wash states, and solid evergreen actions make the product feel grounded without turning its working screens into a spreadsheet or a cold enterprise dashboard.

The public welcome page uses a more editorial register, with Georgia display type, generous story sections, and stronger ambient depth. Keep that distinction: Inter carries the task-focused app; Georgia carries the welcome-page story. Components should feel clear and tactile, not ornamental.

**Key Characteristics:**
- Warm operational clarity.
- Evergreen structure with restrained leaf-wash selection and restock-amber warnings.
- A precise app voice alongside an editorial welcome-page voice.

## Colors

The signed-in app is the Kitchen Ledger palette; the public welcome page uses a related but distinct editorial green-and-oat palette.

### Primary
- **Kitchen Ledger Green:** navigation, links, status, and the app's primary structural color.
- **Ledger Deep:** deeper green for contrast and foregrounds on bright action surfaces.
- **Pantry Lime:** a sparing accent only; it is not the general app primary-action color.
- **Pale Leaf Wash:** quiet selected states and ingredient or activity icon tiles.

### Secondary
- **Welcome Green** and **Welcome Deep:** public-page calls to action and full-width story sections; keep them within the editorial welcome register.
- **Welcome Mint** and **Welcome Cream:** soft public-page section surfaces and accents.

### Tertiary
- **Restock Amber** and **Restock Wash:** communicate restock or warning states without borrowing the danger color.
- **Danger Rust:** reserved for destructive or failed states.

### Neutral
- **Ledger Ink**, **Muted Sage**, and **Quiet Sage:** primary text, supporting copy, and lower-priority metadata.
- **Warm Oat** is the app canvas; **Porcelain** is its working surface; **Fine Line** separates related content without heavy framing.
- **Welcome Ink** and **Welcome Muted** support the marketing page's editorial copy.
- **PWA Olive** remains on the install/browser chrome and account-opening splash. It is a shell tint, not the app's general accent.

**The Pantry-Lime Action Rule.** Keep lime concentrated on meaningful actions and selected states; do not turn every surface into an accent panel.

## Typography

**Display Font:** Georgia, with Times New Roman fallback, for public welcome headlines and the featured quotation.
**Body Font:** Inter, with system sans-serif fallbacks, across app controls, body copy, and the welcome page.

**Character:** The app's Inter hierarchy is compact, confident, and operational. The welcome page's serif display adds a human, editorial cadence without changing the app's working voice.

### Hierarchy
- **Display** (bold, fluid, tight leading): welcome-page hero and section headlines.
- **Headline** (bold, fluid, tight leading): signed-in screen titles.
- **Title** (bold, compact): recipe names, section headers, and data-card titles.
- **Body** (regular, open leading): instructions, descriptions, and supporting explanations.
- **Label** (bold, uppercase, tracked): short section eyebrows, statuses, and metadata labels.

**The Two-Register Rule.** Keep Inter for the signed-in task UI; keep Georgia display type in the public welcome story unless the user explicitly chooses a redesign.

## Layout

The signed-in app is PWA-first: optimize for touch, safe areas, and offline use while treating desktop as a first-class supported surface. It uses a fixed five-destination bottom navigation on narrow screens, then changes to a warm side rail at the desktop breakpoint (980px). Main content uses fluid page gutters and a wide work area; detail and form surfaces remain narrower where comparison density does not help. Pantry quantities use category-grouped rows on both surfaces rather than oversized cards.

The public page is an editorial canvas with a 1260px maximum-width product hero. The product preview is explicitly illustrative; its quantities are labeled sample data. The hero stacks at tablet/mobile widths; the kitchen loop and capabilities adapt to two columns and then one at narrow sizes. Keep the account CTA dominant and let content—not decorative framing—set reading order.

## Elevation & Depth

The signed-in app is flat at rest: warm tonal surfaces and fine borders do most of the grouping. Keep card shadows restrained; allow a slight lift on hover and reserve stronger depth for overlays, the pantry action, or a prominent hero. The welcome page may use more ambient shadows on its illustrative kitchen preview and floating note.

**The Flat-App, Ambient-Marketing Rule.** Do not spread the welcome page's showcase shadows across ordinary app rows and panels.

## Shapes

App fields and buttons use comfortable, gently rounded corners; list cards are a little softer, while hero panels are more generous. Tags and compact status marks use a full pill. The welcome page may use more expressive silhouettes on its mobile preview card, but keep the underlying app controls consistent and tactile.

## Components

### Buttons
- **Primary:** solid Ledger Green with white text in the app; a separate solid Welcome Green CTA on the public page.
- **Secondary:** porcelain surface and fine outline; visually quieter than the primary action.
- **Touch and focus:** keep controls comfortably tappable and give keyboard focus a clear, high-contrast outline.

### Chips
- Segmented controls use a soft neutral track and a distinct porcelain selected state; selected text stays in the app's evergreen family.
- Small tags and status marks may use a full pill, but do not use pill styling for every control.

### Cards / Containers
- Pantry, recipe, and activity rows are near-flat porcelain surfaces with fine borders. Use hover lift as feedback, not as their resting state.
- Detail and editor sections use a larger radius and comfortable inset spacing; the pantry overview is the signature lime feature panel.

### Inputs / Fields
- Use porcelain fields with a fine border and a clear evergreen focus ring. Preserve readable labels above fields and keep error color distinct from restock warnings.

### Navigation
- Mobile: five destinations in a translucent bottom bar, with a leaf-wash active state.
- Desktop: warm side rail with a leaf-wash active destination. Keep labels and icons aligned as a single target.

### Pantry Overview
- A quiet leaf-wash panel surfaces tracked stock readiness and the next useful action. Keep its numbers and call to action clear; no catalog-wide zero counts should imply shopping intent.

### Pantry tracking and quantities
- Catalog ingredients are untracked until a cook chooses to track them. Only a tracked ingredient with a zero balance is “Needs restock”; a tracked item must be brought to zero before tracking can be stopped.
- Grocea is metric-only. Do not render a disabled measurement-system preference. Display ingredient amounts in consistent readable metric scales (g/kg, ml/L, and item counts) while retaining precise canonical amounts.

## Do's and Don'ts

### Do:
- **Do** keep task screens scan-friendly, with the current balance or status easy to find before secondary details.
- **Do** use the app and welcome page as related but distinct registers: operational Inter UI inside, editorial Georgia display on the public page.
- **Do** preserve the responsive switch from bottom navigation to side navigation and maintain comfortable touch targets.
- **Do** use borders and tonal surfaces before adding app-wide shadows.

### Don't:
- **Don't** make ordinary app cards look like floating marketing showcases.
- **Don't** let the PWA olive shell tint replace the signed-in app's ledger-green and pantry-lime palette.
- **Don't** flatten the current warm, precise character into a cold enterprise dashboard or add decoration that competes with stock and recipe information.
- **Don't** reuse the dark-green primary-button hover without checking foreground contrast; the current CSS changes its background but does not explicitly change its text color.
