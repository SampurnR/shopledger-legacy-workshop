# ShopLedger Contributor Guide

## Technology stack

- Node.js application using CommonJS modules.
- Express 4 server with `body-parser` for JSON request bodies.
- Vanilla HTML, CSS, and JavaScript frontend served from `public/`.
- JSON file storage in `data/db.json`, read and written synchronously by `lib/store.js`.

## Module map

- `server.js`: creates the Express app, serves static frontend files, mounts API routers, and renders printable invoices.
- `config.js`: application port, shop details, GST slabs, coupon rules, inventory defaults, and the admin export key.
- `public/`: browser UI in `index.html`, styling in `css/style.css`, and client-side behavior/API calls in `js/app.js`.
- `routes/`: Express routers for products and coupons, orders, customers and settlements, reports, pricing preview, and admin export.
- `lib/`: business logic for coupons, dates, inventory, invoices, customer ledger, orders, pricing, reports, JSON storage, and GST rates.
- `data/db.json`: tracked application data containing products, orders, customers, settlements, audit entries, and ID counters.

## Commands

- Install dependencies: `npm install`
- Start the application: `npm start` (runs `node server.js`)
- Run all tests: `node --test`
- Run Issue #1 regressions: `node --test test/issue-1-regression.test.js test/issue-1-review.test.js`
- Run characterization tests: `node --test test/issue-1-characterization.test.js`

The current `npm test` script remains a placeholder: it prints `Error: no test specified` and exits with status 1. Tests in `test/` use built-in `node:test` and `node:assert/strict` with in-memory fixtures. They cover the characterization baseline (updated for the corrected behavior), original RED-phase regressions, and supplemental review regressions.

## Safety rules

- Write characterization tests before changing existing behavior.
- Change only the module or modules directly required by the selected GitHub issue.
- Never run tests against or modify `data/db.json`. Use isolated in-memory fixtures or temporary test data.
- Do not introduce new dependencies.
- Make the smallest correct fix and preserve unrelated behavior.
- Review changes and run relevant tests before committing.

## Current workshop focus

GitHub Issue #1: GST invoice and checkout calculation mismatch. `lib/invoice.js` now reuses `lib/pricing.js`'s `computeTotals()`, which delegates to the existing GST and coupon modules. `lib/reports.js` performs reconciliation. See `docs/README.md` for the preserved pre-fix CP2 diagrams and remaining limitations.

Use explicit file paths when staging workshop work; exclude the generated `package-lock.json` from the eventual PR.
