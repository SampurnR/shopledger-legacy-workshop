# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a Node.js/Express POS and ledger app. `server.js` serves `public/` and mounts handlers from `routes/`. Business rules live in `lib/`; `config.js` holds settings, tax slabs, coupons, and inventory defaults. `data/db.json` is the operational dataset; `docs/` holds documentation. There is no test directory.

## Current Application State

Version 0.8.4 includes POS, order history, khata, and inventory/GST audit screens. Data is stored in JSON. No build, lint, formatter, or test framework is configured; `npm test` is a failing placeholder. Known issues: cancellation does not restore stock correctly, and invoice calculations differ from order pricing/GST calculations. Reconciliation is not proof that tax figures are correct.

## Build, Test, and Development Commands

- `npm start` starts the app on port 3000 by default; set `PORT` to override it.
- `npm test` exits with an error; it is not a test suite.
- No build, lint, or formatter command is configured. Dependencies are in `package.json` and `package-lock.json`.

## Coding Style & Naming Conventions

Use existing CommonJS style: `require()`, `module.exports`, single quotes, semicolons, `var`, and two-space indentation. Use lowercase filenames and camelCase identifiers. Keep route handlers focused on HTTP behavior; put reusable rules in `lib/`.

## Testing Guidelines

No framework or coverage target exists. If adding tests, use descriptive names (for example, `filters products by category`). For categorization, check `GET /api/products?category=Staples%20%26%20Grains`, UI category pills, case-insensitive matching, and search against `data/db.json`. For other changes, document routes and manual checks. `npm test` validates nothing.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`); no formal prefix convention is evident. Keep commits focused. PRs should describe behavior, affected modules, data/config impacts, UI screenshots, and verification. Link issues when available.

## Security & Data Handling

Treat `data/db.json` as operational data; do not overwrite or commit local changes unintentionally. Keep secrets out of source control. Review authorization when changing routes or deployment settings.
