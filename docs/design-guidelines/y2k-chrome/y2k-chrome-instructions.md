# Y2K Chrome - Construction Instructions & AI Prompting Guide
> Version 1.0 - Theme 24 in the catalog - slug `y2k-chrome`

---

## Table of Contents

1. [Design Philosophy & Core Rules](#1-design-philosophy--core-rules)
2. [Font Law](#2-font-law)
3. [Color Application Rules](#3-color-application-rules)
4. [Border Radius Decision Framework](#4-border-radius-decision-framework)
5. [Shadow & Elevation Rules](#5-shadow--elevation-rules)
6. [Component Construction Guides](#6-component-construction-guides)
7. [Interactive States](#7-interactive-states)
8. [Layout Rules](#8-layout-rules)
9. [Anti-Patterns](#9-anti-patterns)
10. [AI Prompting Guide](#10-ai-prompting-guide)
11. [Pre-Ship Checklist](#11-pre-ship-checklist)

---

## 1. Design Philosophy & Core Rules

Turn-of-the-millennium chrome: silver gradients, bubblegum pink and cyber blue accents, pill shapes and glossy bubbles.

### The Rules
1. Chrome gradients on actions, flat silver on panels.
2. Pills everywhere: buttons, inputs and badges round fully.
3. Pink and blue are accents; the base stays cool silver.
4. Unbounded headlines, Work Sans for everything else.
5. Bento and table containers pin their own radius, never inherit the pill.

---

## 2. Font Law

Use only Unbounded and Work Sans. Fallback stacks end in `system-ui, sans-serif`.

- Display and headings: Unbounded, per the type scale in the design-system doc.
- Body: Work Sans.
- Labels, buttons and badges: Work Sans.
- Never mix in a font from another system. If a glyph is missing, fall back, do not swap families.

---

## 3. Color Application Rules

|Use|Token|Value|
|---|---|---|
|Page base|`--ds-color-bg-base`|`#e9e7f5`|
|Cards and panels|`--ds-color-bg-surface`|`#f4f3fb`|
|Inputs, wells|`--ds-color-bg-sunken`|`#dcdaf0`|
|Chrome action gradient base|`--ds-color-primary`|`#8f7bff`|
|Bubblegum secondary|`--ds-btn-secondary-bg`|`#232333`|
|Body text|`--ds-color-text-primary`|`#232333`|
|Supporting text|`--ds-color-text-secondary`|`#3f3f55`|

- Body text `#23242e` on `#f4f5fb` base: 13.5:1.
- Chrome button text `#23242e` on the silver gradient: above 8:1 across the gradient.
- Pink `#ff6ec7` and blue `#5b8cff` appear on fills and badges with dark or white foregrounds, never as body text.
- Never type a raw hex or font name in a component. Read the token.

---

## 4. Border Radius Decision Framework

- `--ds-radius-badge` = `999px`
- `--ds-radius-sm` = `10px`
- `--ds-radius-md` = `9999px`
- `--ds-radius-lg` = `24px`
- `--ds-radius-xl` = `28px`
- `--ds-radius-full` = `9999px`

Full pills for controls and badges; cards get 24px bubbles. The scoped `.ds-bento-card` override pins bento corners to 16px so the pill radius cannot clip content.

---

## 5. Shadow & Elevation Rules

- `--ds-shadow-card` = `0 18px 40px rgba(120,120,190,0.25)`
- `--ds-shadow-dropdown` = `0 12px 28px rgba(120,120,190,0.28)`
- `--ds-shadow-modal` = `0 24px 56px rgba(120,120,190,0.3)`
- `--ds-shadow-focus` = `0 0 0 3px #b8c0ff`
- `--ds-shadow-btn-hover` = `0 8px 20px rgba(150,150,220,0.45)`

---

## 6. Component Construction Guides

- **Buttons:** Silver-to-white chrome gradient with a cool border; hover brightens, active presses flat. Secondary is bubblegum pink.
- **Inputs:** Pill fields on the sunken tint; focus ring is cyber blue at 40% alpha.
- **Cards:** Glossy white bubble at 24px radius with a soft blue-grey shadow.
- **Badges:** Pink or blue pill, uppercase, white or dark text by fill.
- **Tables:** Header row on the sunken silver tint; pill-radius container.

---

## 7. Interactive States

- Hover: `--ds-color-primary-hover` fill plus `--ds-shadow-btn-hover`.
- Active: `--ds-btn-active-transform` with the active tone.
- Focus: always `--ds-focus-ring`, visible on every interactive element.
- Disabled: 50% opacity, no shadow, `not-allowed` cursor.

---

## 8. Layout Rules


- Max content width 1040px, 24px gutters.
- Stack to one column below 768px.
- Keep one primary action per section and align it to the same edge as the heading.

---

---

## 9. Anti-Patterns

- Gradients on panels. Chrome belongs to actions only.
- Square buttons. Everything interactive is a pill.
- Pink or blue body text on silver. Accents stay on fills.
- Letting the pill radius reach cards that hold dense content.
- Heavy ink borders. Y2K is borderless gloss.
- Serif or monospace fonts. This is Unbounded and Work Sans only.

---

## 10. AI Prompting Guide

Ask for the system by name and slug, then state the surfaces you need. The tokens do the rest.

> Build a product page in the Y2K Chrome system: cool silver base, chrome-gradient primary pill button, bubblegum pink secondary, Unbounded hero heading, glossy 24px cards, cyber blue focus rings.

Always reference tokens (`--ds-*`) in generated code, never raw values. Keep overrides scoped under `[data-ds="y2k-chrome"]`.

---

## 11. Pre-Ship Checklist

- [ ] Every colour, font, radius and shadow reads from a `--ds-*` token.
- [ ] Overrides are scoped under `[data-ds="y2k-chrome"]` only.
- [ ] Fonts load via `DESIGN_SYSTEM_FONTS_URL`, not a CSS `@import`.
- [ ] Text contrast passes 4.5:1 (checked in section 3.3 of the design-system doc).
- [ ] Focus rings visible on every interactive element.
- [ ] Chrome gradients on actions, flat silver on panels.
- [ ] Pills everywhere: buttons, inputs and badges round fully.
- [ ] Cards, tables and bento containers render without clipped corners.
- [ ] Build, lint, typecheck and `verify:seo` pass.
