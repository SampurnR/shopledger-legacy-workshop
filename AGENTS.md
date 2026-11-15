# Repository Guidelines

## Project Structure & Module Organization

This is a small CommonJS Node.js and Express app. `server.js` wires middleware, static assets, and routes. `routes/` contains the products, orders, customers, and reports API handlers. `lib/` contains storage (`store.js`), order, inventory, pricing, coupon, tax, ledger, invoice, report, and date logic. The browser UI lives in `public/` (`index.html`, `js/app.js`, and `css/style.css`); `config.js` holds shop and business rules. `data/db.json` is the file-backed application database. There is no test directory or configured test framework.

## Build, Test, and Development Commands

- `npm start` - starts the server on `PORT`, or port `3000` if unset.
- `node server.js` - equivalent direct start for local development.
- `npm test` - currently a placeholder that exits with an error; no automated tests are configured.

There is no build, lint, or formatting command configured. Do not assume installing packages is needed for source-only work.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, semicolons, single-quoted strings, `var`, CommonJS `require`/`module.exports`, and small focused functions. Use lowercase descriptive filenames such as `gst-reconciliation.js` if adding a module. Keep HTTP input validation in route handlers and reusable business rules in `lib/`.

## Testing Guidelines

No test framework or coverage target is present. For changes, describe the affected path and the verification performed. If adding tests, first introduce a test framework and document its command; name test files after the module or behavior they cover.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries without a required prefix (for example, `support hsn gst slabs and coupon maxDiscount caps`). Keep changes focused. PRs should explain behavior changes, list manual verification, and include screenshots for UI changes. Call out data-format or configuration changes explicitly.

## Security & Data

Treat `data/db.json` as persistent business data; do not add real customer records, credentials, or secrets to commits. Validate request values at API boundaries, and escape untrusted values before rendering them into HTML. Keep tax, coupon, and inventory rules consistent across previews, order creation, and invoices.
