# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Node/Express application with a browser-based POS. `server.js` creates the Express app and mounts API routers from `routes/`. Keep HTTP handling in the matching route file: `products.js`, `orders.js`, `customers.js`, or `reports.js`.

Put business rules in `lib/`: `pricing.js` and `tax.js` calculate checkout figures, `inventory.js` handles stock, `ledger.js` handles Khata, `orders.js` manages order lifecycle, and `store.js` persists data. `config.js` holds shop, GST slab, and coupon configuration. `data/db.json` is the local datastore; treat it as production-like sample data. Browser assets live in `public/` (`index.html`, `js/app.js`, and `css/style.css`). The architecture diagram is `docs/architecture.svg`.

## Build, Test, and Development Commands

- `npm install` installs the Express and body-parser dependencies.
- `npm start` runs `node server.js`, serving the UI on `http://localhost:3000` unless `PORT` is set.
- `npm test` currently exits with an error because no test suite is configured; add tests and update this script when introducing a test runner.

## Coding Style & Naming Conventions

Use the existing ES5-style JavaScript: `var`, `function` expressions, semicolons, and two-space indentation. Prefer small, named exports such as `exports.computeTotals` and keep route handlers thin by delegating to `lib/`. Use lowercase, singular-or-domain-focused filenames (for example, `lib/invoice.js`) and camelCase variables/functions. Round monetary values through the project’s `round2` pattern and do not trust price or HSN values supplied by the browser.

## Testing Guidelines

There is no automated test framework or coverage target today. For any calculation, inventory, cancellation, or Khata change, add focused tests before changing behavior. Cover GST slabs, coupon thresholds/caps, rounding, stock updates, and persisted order totals. Until a runner exists, manually exercise the relevant API flow and record the request/expected response in the PR.

## Commits & Pull Requests

Recent commits use concise, lowercase, imperative-style summaries, for example `support hsn gst slabs and coupon maxDiscount caps`. Keep each commit scoped to one concern. PRs should explain the behavior change, name affected routes/modules, describe data migrations to `data/db.json`, and include screenshots for UI or printable-invoice changes. Link the issue or reconciliation example when applicable.

## Security & Data Handling

Do not commit credentials or customer data exports. Review changes to `config.js`, `/api/admin/export`, invoice HTML escaping, and JSON persistence carefully: the database contains customer contact, GSTIN, credit, and order data.
