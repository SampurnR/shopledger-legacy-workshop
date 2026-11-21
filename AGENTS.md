# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js/Express app. `server.js` mounts API routers from `routes/`; shared business logic lives in `lib/` (pricing, tax, coupons, inventory, orders, ledger, reports, invoices, dates, and JSON storage). Browser assets are in `public/`, runtime shop settings are in `config.js`, and the local data store is `data/db.json`. Architecture documentation is in `docs/`. There is no test directory in the repository.

## Build, Test, and Development Commands

- `npm start` runs the app with `node server.js` on port 3000 by default; set `PORT` to override it.
- `npm test` is currently a placeholder that exits with an error; no automated test suite or build command is configured.
- Install dependencies with `npm install` when setting up a development environment. Do not run installation as part of routine code changes unless dependencies need updating.

## Coding Style & Naming Conventions

Follow the existing CommonJS JavaScript style: two-space indentation, single-quoted strings, semicolons, and `var` declarations. Use lower camelCase for functions and variables, and lowercase filenames such as `pricing.js` and `orders.js`. Keep route handling in `routes/` and reusable calculations or data operations in `lib/`. Preserve the existing money-rounding and JSON data conventions when touching totals or persistence. No formatter or linter is configured.

## Testing Guidelines

There is no test framework or coverage target yet. For changes, manually check the affected flow and inspect its response and persisted data where applicable. Pricing changes should account for coupons, HSN GST rates, and invoice reconciliation; inventory and Khata changes should also check cancellation or settlement behavior. Do not treat the current `npm test` placeholder as verification.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`). Follow that style and keep each commit focused. Pull requests should explain the user-visible change, list relevant manual checks, link related work when available, and include screenshots for browser UI changes. Call out changes to `data/db.json`, configuration, or persisted order formats.

## Security & Configuration

Do not commit real customer or shop secrets. Review `config.js` before deployment: it contains shop details and a hard-coded admin key. Treat `data/db.json` as operational data and avoid including personal details in examples or screenshots.
