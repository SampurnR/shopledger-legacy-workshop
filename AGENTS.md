# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Node/Express POS, inventory, Khata-credit, and GST-invoicing application. `server.js` creates the app and mounts the API routers in `routes/`: `products.js`, `orders.js`, `customers.js`, and `reports.js`. Keep HTTP concerns in those routers and place reusable business rules in `lib/` (for example, stock logic in `lib/inventory.js` and order lifecycle logic in `lib/orders.js`).

`public/` contains the browser UI (`index.html`, `js/app.js`, and `css/style.css`). `config.js` contains shop, tax, inventory, and coupon settings. `data/db.json` is the application’s JSON datastore; treat it as operational data, not a test fixture. `docs/` holds repository documentation and diagrams.

## Build, Test, and Development Commands

- `npm start` — starts `node server.js` on `PORT` or port `3000`.
- `npm test` — currently exits with “no test specified”; there is no committed test runner or build command.

Do not run exploratory tests against `data/db.json`. For a future test, copy its data into a temporary fixture outside the tracked data file and clean it up afterward.

## Coding Style & Naming Conventions

Use the repository’s existing CommonJS and ES5-style JavaScript: `var`, `require(...)`, `exports.name = function (...)`, semicolons, and two-space indentation. Use lower-case filenames matching the module responsibility, such as `lib/pricing.js`. Preserve existing API route naming under `/api` and return JSON errors as `{ error: '...' }`.

Keep changes narrowly scoped. Read the affected router, library module, and persistence path before editing; add a regression test before changing behaviour when a test harness is introduced. Do not combine an order/inventory fix with unrelated UI or configuration changes.

## Testing Guidelines

No testing framework, coverage target, or test directory exists today. When adding tests, name them after the module and behaviour (for example, `test/inventory.cancel.test.js`) and cover both the normal path and the relevant boundary/error path. Pin current behaviour first, especially around stock, totals, Khata balances, and cancellation.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, for example `support hsn gst slabs and coupon maxDiscount caps`. Follow that style: lowercase, focused, and descriptive. Keep each commit limited to one concern. Pull requests should explain the user-visible change, list verification performed, identify any `data/db.json` impact, and include screenshots for `public/` UI changes.

## Security & Data Handling

Never put new secrets in `config.js` or client code. Validate request inputs at the router boundary, and remember that `store.write()` rewrites the complete JSON datastore. Review the diff before opening a pull request.
