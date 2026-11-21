# Y2K Chrome - Complete Design System
> Version 1.0 - Theme 24 in the catalog - slug `y2k-chrome`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [CSS Custom Properties - Master Token Sheet](#2-css-custom-properties--master-token-sheet)
3. [Color Palette](#3-color-palette)
4. [Typography System](#4-typography-system)
5. [Spacing System](#5-spacing-system)
6. [Border Radius System](#6-border-radius-system)
7. [Shadow & Elevation System](#7-shadow--elevation-system)
8. [Component Specifications](#8-component-specifications)
9. [Layout & Grid System](#9-layout--grid-system)
10. [Animation & Transition Tokens](#10-animation--transition-tokens)
11. [Z-Index System](#11-z-index-system)
12. [Breakpoints](#12-breakpoints)
13. [Icon System](#13-icon-system)
14. [State Definitions](#14-state-definitions)

---

## 1. System Overview

**Design Language:** Y2K Chrome
**Mode:** Light
**Typefaces:** Unbounded + Work Sans
**Personality:** Turn-of-the-millennium chrome: silver gradients, bubblegum pink and cyber blue accents, pill shapes and glossy bubbles.
**Best Suited For:** Music and fashion launches, nostalgic tech, playful e-commerce, fan and community sites

**Core Principles:**
- Chrome gradients on actions, flat silver on panels.
- Pills everywhere: buttons, inputs and badges round fully.
- Pink and blue are accents; the base stays cool silver.
- Unbounded headlines, Work Sans for everything else.

---

## 2. CSS Custom Properties - Master Token Sheet

All tokens are scoped under `[data-ds="y2k-chrome"]`. Nothing is defined at `:root`. The same sheet ships as `tokens.css` in this system's folder.

```css
/*
 * Y2K Chrome - scoped design-system tokens (Theme 24 in catalog).
 * Iridescent metal and bubble UI. Unbounded + Work Sans.
 */

[data-ds="y2k-chrome"] {
  --ds-color-bg-base: #e9e7f5;
  --ds-color-bg-surface: #f4f3fb;
  --ds-color-bg-sunken: #dcdaf0;
  --ds-color-bg-secondary: #dcdaf0;
  --ds-color-bg-overlay: rgba(35,35,51,0.45);

  --ds-color-primary: #8f7bff;
  --ds-color-primary-hover: #7d68f5;
  --ds-color-primary-active: #6b54e8;
  --ds-color-primary-fg: #232333;

  --ds-color-text-primary: #232333;
  --ds-color-text-secondary: #3f3f55;
  --ds-color-text-tertiary: #54546b;
  --ds-color-text-muted: #5c5c78;
  --ds-color-text-disabled: #9c9cb8;
  --ds-color-text-inverse: #f4f3fb;

  --ds-color-border-light: #c9c9ee;
  --ds-color-border-medium: #b8b8e4;
  --ds-color-border-strong: #8f7bff;

  --ds-color-success: #1b7441;
  --ds-color-success-bg: #d7f2e0;
  --ds-color-warning: #8a5700;
  --ds-color-warning-bg: #fff0cc;
  --ds-color-error: #c0262d;
  --ds-color-error-bg: #fde3e4;
  --ds-color-info: #4a3fd1;
  --ds-color-info-bg: #e3e1fb;

  --ds-font-display: "Unbounded", system-ui, sans-serif;
  --ds-font-body: "Work Sans", system-ui, sans-serif;
  --ds-font-label: "Work Sans", system-ui, sans-serif;
  --ds-label-transform: none;
  --ds-label-tracking: 0.01em;
  --ds-label-weight: 600;
  --ds-heading-tracking: 0;
  --ds-heading-weight: 600;

  --ds-radius-badge: 999px;
  --ds-radius-sm: 10px;
  --ds-radius-md: 9999px;
  --ds-radius-lg: 24px;
  --ds-radius-xl: 28px;
  --ds-radius-full: 9999px;

  --ds-border-width: 1px;

  --ds-shadow-card: 0 18px 40px rgba(120,120,190,0.25);
  --ds-shadow-dropdown: 0 12px 28px rgba(120,120,190,0.28);
  --ds-shadow-modal: 0 24px 56px rgba(120,120,190,0.3);
  --ds-shadow-focus: 0 0 0 3px #b8c0ff;
  --ds-shadow-btn-hover: 0 8px 20px rgba(150,150,220,0.45);

  --ds-btn-text-transform: none;
  --ds-btn-letter-spacing: 0.01em;
  --ds-btn-font-weight: 700;
  --ds-btn-active-transform: scale(0.98);
  --ds-btn-secondary-bg: #232333;
  --ds-btn-secondary-text: #ffc6ff;
  --ds-btn-secondary-border: #232333;
  --ds-btn-secondary-hover-bg: #3a3a52;
  --ds-btn-outline-text: #232333;
  --ds-btn-outline-border: #b8c0ff;
  --ds-btn-outline-hover-bg: rgba(255,255,255,0.6);
  --ds-btn-outline-hover-text: #232333;

  --ds-table-header-bg: #dcdaf0;
  --ds-table-header-text: #232333;
  --ds-table-header-border-bottom: 1px solid #b8b8e4;
  --ds-table-container-radius: 24px;
  --ds-table-container-border: 1px solid rgba(255,255,255,0.9);

  --ds-focus-ring: 0 0 0 3px #b8c0ff;

  --ds-ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --ds-duration-fast: 120ms;
  --ds-duration-base: 180ms;
  --ds-duration-slow: 280ms;
}

/* Translucent chrome with an inner highlight; gradients run pink-lilac-blue, never neon. */
[data-ds="y2k-chrome"] .ds-btn-primary { background: linear-gradient(120deg, #b8c0ff, #ffc6ff); border: 1px solid rgba(255,255,255,0.9); color: #232333; }
[data-ds="y2k-chrome"] .ds-card, [data-ds="y2k-chrome"] .ds-modal { background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55)); border: 1px solid rgba(255,255,255,0.9); box-shadow: var(--ds-shadow-card), inset 0 1px 0 #ffffff; }
[data-ds="y2k-chrome"] .ds-bento-card { border-radius: 24px; }
[data-ds="y2k-chrome"] .ds-bento-scope { background: linear-gradient(150deg, #e9e7f5 0%, #d7e4f5 45%, #f6e3f0 100%); }
[data-ds="y2k-chrome"] .ds-bento-title { background: linear-gradient(100deg, #7b8cff, #d67bd8, #7b8cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
```

---

## 3. Color Palette

### 3.1 Core Colors

|Role|Token|Value|Usage|
|---|---|---|---|
|bg-base|`--ds-color-bg-base`|`#e9e7f5`|Page base|
|bg-surface|`--ds-color-bg-surface`|`#f4f3fb`|Cards and panels|
|bg-sunken|`--ds-color-bg-sunken`|`#dcdaf0`|Inputs, wells|
|primary|`--ds-color-primary`|`#8f7bff`|Chrome action gradient base|
|secondary-bg|`--ds-btn-secondary-bg`|`#232333`|Bubblegum secondary|
|text-primary|`--ds-color-text-primary`|`#232333`|Body text|
|text-secondary|`--ds-color-text-secondary`|`#3f3f55`|Supporting text|

### 3.2 Semantic Colors

|State|Token|Ink|Background|
|---|---|---|---|
|success|`--ds-color-success`|`#1b7441`|`#d7f2e0`|
|warning|`--ds-color-warning`|`#8a5700`|`#fff0cc`|
|error|`--ds-color-error`|`#c0262d`|`#fde3e4`|
|info|`--ds-color-info`|`#4a3fd1`|`#e3e1fb`|

### 3.3 Contrast Checks

- Body text `#23242e` on `#f4f5fb` base: 13.5:1.
- Chrome button text `#23242e` on the silver gradient: above 8:1 across the gradient.
- Pink `#ff6ec7` and blue `#5b8cff` appear on fills and badges with dark or white foregrounds, never as body text.

---

## 4. Typography System

### 4.1 Font Families

|Role|Family|Usage|
|---|---|---|
|Display|Unbounded|Headings, hero titles|
|Body|Work Sans|Body copy, form fields|
|Label|Work Sans|Buttons, badges, labels|

### 4.2 Type Scale


| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | 48-64px | 400 | 0 | Hero title |
| H1 | 36px | 400 | 0 | Page title |
| H2 | 28px | 400 | 0 | Section title |
| H3 | 20px | 400 | 0 | Card title |
| Body | 16px | 400 | 0 | Paragraphs |
| Label | 13px | 700 | 0.01em | Buttons, badges |

Lilita One ships in a single weight (400). Its drawn strokes are already heavy - never synthesise a bolder weight.

### 4.3 Google Fonts Import Block

Fonts load through the shared `DESIGN_SYSTEM_FONTS_URL` in `app/design-systems/fonts.ts`. Never `@import` a remote font URL from CSS; the production bundler drops it.

---

## 5. Spacing System


Base unit: 4px. Use only these steps.

| Token | Value |
|---|---|
| space-1 | 4px |
| space-2 | 8px |
| space-3 | 12px |
| space-4 | 16px |
| space-6 | 24px |
| space-8 | 32px |
| space-12 | 48px |
| space-16 | 64px |

Component padding: card 22px, button 11px 22px (md), input 11px 14px, badge 3px 12px.

---

---

## 6. Border Radius System

|Token|Value|
|---|---|
|badge|`999px`|
|sm|`10px`|
|md|`9999px`|
|lg|`24px`|
|xl|`28px`|
|full|`9999px`|

Full pills for controls and badges; cards get 24px bubbles. The scoped `.ds-bento-card` override pins bento corners to 16px so the pill radius cannot clip content.

---

## 7. Shadow & Elevation System

|Token|Value|
|---|---|
|card|`0 18px 40px rgba(120,120,190,0.25)`|
|dropdown|`0 12px 28px rgba(120,120,190,0.28)`|
|modal|`0 24px 56px rgba(120,120,190,0.3)`|
|focus|`0 0 0 3px #b8c0ff`|
|btn-hover|`0 8px 20px rgba(150,150,220,0.45)`|

---

## 8. Component Specifications

### 8.1 Buttons

Silver-to-white chrome gradient with a cool border; hover brightens, active presses flat. Secondary is bubblegum pink.

### 8.2 Form Inputs

Pill fields on the sunken tint; focus ring is cyber blue at 40% alpha.

### 8.3 Labels

Work Sans 600, sentence case, cool grey.

### 8.4 Card / Surface

Glossy white bubble at 24px radius with a soft blue-grey shadow.

### 8.5 Badge

Pink or blue pill, uppercase, white or dark text by fill.

### 8.6 Checkbox, Radio and Switch

Round checkboxes and radios; the check dot is chrome gradient.

### 8.7 Table

Header row on the sunken silver tint; pill-radius container.

### 8.8 Dropdown Panel

24px bubble panel with the soft card shadow.

---

## 9. Layout & Grid System


| Container | Max width |
|---|---|
| Narrow (forms, articles) | 640px |
| Default | 1040px |
| Wide (dashboards) | 1280px |

12-column grid, 24px gutters on desktop, 16px on mobile.

---

---

## 10. Animation & Transition Tokens


| Token | Value |
|---|---|
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Fast | 0ms |
| Base | 120ms |
| Slow | 200ms |

Animate colour, transform, opacity and shadow only. Never animate layout properties.

---

---

## 11. Z-Index System


| Layer | Value |
|---|---|
| Base | 0 |
| Sticky header | 10 |
| Dropdown | 20 |
| Modal backdrop | 40 |
| Modal | 50 |
| Toast | 60 |

---

---

## 12. Breakpoints


| Name | Min width |
|---|---|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |

Page padding: 16px below md, 24px at md, 32px at lg and up.

---

---

## 13. Icon System

Icons use 2px strokes with round caps, matching the pill geometry. Sizes follow the shared scale: 16px inline, 20px in buttons, 24px standalone.

---

## 14. State Definitions

- Hover uses the `--ds-color-primary-hover` and `--ds-shadow-btn-hover` tokens.
- Active applies `--ds-btn-active-transform` and the `--ds-color-primary-active` tone.
- Focus always renders `--ds-focus-ring`; never remove it without a visible replacement.
- Disabled drops to 50% opacity with `not-allowed` cursor and no shadow.
