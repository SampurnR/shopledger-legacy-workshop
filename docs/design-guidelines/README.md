# Design Guidelines

Design guideline documents for this project live here, one folder per design system. They are binding for UI work, the same way `docs/rules/` is binding for code.

## y2k-chrome/

The Y2K Chrome design system (Theme 24, slug `y2k-chrome`).

- `y2k-chrome-design-system.md` — tokens, palette, typography, spacing, radius, shadows, component specs.
- `y2k-chrome-instructions.md` — construction rules: font law, color application, radius and shadow decisions, component and layout rules, pre-ship checklist.
- `tokens.css` — the master token sheet from the design-system doc, shipped as CSS per that doc. All tokens are scoped under `[data-ds="y2k-chrome"]`; nothing is defined at `:root`.
