# Repository Guidelines

## Project Structure & Module Organization

`server.js` creates the Express application, serves `public/`, and mounts the API routers. Keep request/response handling in `routes/` (`products.js`, `orders.js`, `customers.js`, and `reports.js`); move reusable business rules into `lib/`. Key modules include `pricing.js` and `tax.js` for checkout figures, `ledger.js` for Khata balances, `inventory.js` for stock, and `store.js` for persistence. `public/` is the browser UI (`index.html`, `css/style.css`, `js/app.js`). `data/db.json` is the JSON datastore; treat it as business data, not a generated cache. `docs/` contains repository documentation and diagrams.

## Build, Test, and Development Commands

- `npm start` — run `node server.js` on `PORT` or port 3000.
- `npm test` — currently exits with “no test specified”; there is no automated test suite yet.

There is no build step, linter, formatter, or package lockfile. For changes, manually exercise the affected API/UI flow and the invoice route, for example `GET /orders/:id/invoice` after an order is created.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) and ES5-style JavaScript consistent with the repository. Use two-space indentation, semicolons, `var`, camelCase identifiers, and descriptive function names such as `computeTotals` or `chargeOrderToKhata`. Keep filenames lowercase and focused by responsibility (for example, `lib/invoice.js`). Preserve the existing explicit rounding helpers for monetary values; do not introduce floating-point calculations inline without rounding.

## Testing Guidelines

Add focused tests when introducing a test runner, especially for coupon caps/minimums, HSN GST slabs, rounding, inventory reservation/cancellation, and Khata credit limits. Name test files after the module under test (for example, `test/pricing.test.js`). Until then, record manual verification in pull requests, including inputs and expected stored totals.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, imperative summaries such as `invoice page for accountant` and `support hsn gst slabs and coupon maxDiscount caps`. Follow that style and keep each commit narrowly scoped. PRs should explain the business impact, list manual checks, link the issue when available, and include screenshots for `public/` or invoice-layout changes. Call out any `data/db.json` migration or sample-data change explicitly.

## Security & Data Handling

Do not commit secrets, production customer data, or credentials. `config.js` and `data/db.json` contain sensitive operational settings and financial/customer records; review changes to both carefully. Maintain a single source of truth for tax and discount logic so checkout, reports, and printable invoices remain reconcilable.
