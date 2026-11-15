# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a CommonJS Node.js/Express app with a plain HTML/CSS/JavaScript interface. `server.js` starts the app; `config.js` contains shop, tax, inventory, and coupon settings. API handlers live in `routes/`, with business logic in `lib/` (orders, inventory, pricing/tax, Khata ledger, invoices, reports, dates, and JSON storage). The browser UI and static assets are in `public/`. `data/db.json` is the checked-in file-backed dataset. Architecture documentation is in `docs/`; dependency-free characterization tests are in `test/`.

## Build, Test, and Development Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js` and serves the app on port 3000 by default; set `PORT` to override it.
- `npm test` runs Node's built-in test runner in-process (`node --test --test-isolation=none`) over the files in `test/`.

There is no build or lint script. Tests use Node's built-in `node:test` and `node:assert` modules; no test dependencies are needed.

## Coding Style & Naming Conventions

Match the existing style: two-space indentation, semicolons, single-quoted strings, CommonJS `require`/`module.exports`, and straightforward callbacks/functions. Use lower camel case for JavaScript variables and functions; use descriptive lowercase filenames such as `gst-reconciliation.js` only if adding new files (existing modules mostly use short lowercase names). Keep route wiring in `routes/` and reusable calculations or domain logic in `lib/`. No formatter or linter is configured.

## Testing Guidelines

Tests are named `test/<area>.test.js` and characterize module behavior with in-memory fixtures; they do not read or write the checked-in database. Run `npm test` after relevant changes. These tests record current behavior, including known quirks; update assertions deliberately when behavior is corrected. No coverage target is configured.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`). Follow that style and describe the behavior changed. PRs should summarize user-visible and data-related effects, list verification performed, and include screenshots for UI changes. Call out any change to `data/db.json` or persisted order/ledger behavior.

## Data & Configuration Notes

The app reads and rewrites the whole `data/db.json` file. Avoid using live or valuable data for local experiments; preserve the file unless a data change is intended. Keep environment-specific secrets out of source control, and review `config.js` carefully before deployment because it contains operational settings.
