# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a Node.js/Express application for retail and wholesale billing, inventory, and customer khata accounts.

- `server.js` wires middleware, `/api` routes, static assets, and printable invoices.
- `routes/` contains product, order, customer, and report HTTP handlers.
- `lib/` contains pricing, GST, coupons, inventory, ledger, invoice, date, and persistence logic. Keep business rules here rather than duplicating them in routes or the UI.
- `public/` contains `index.html`, `js/app.js`, and `css/style.css`; there is no frontend build pipeline.
- `config.js` holds shop details and business settings. `data/db.json` is the writable datastore; `docs/architecture.png` is an architecture reference.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package.json` and the lockfile.
- `npm start`: launch the server at `http://localhost:3000`.
- PowerShell: `$env:PORT=3001; npm start` launches on an alternate port.
- `node --check lib/pricing.js`: syntax-check a changed JavaScript file; repeat for other edited files.
- `npm test`: currently prints “no test specified” and exits with failure. It is not a working test suite.

No build, lint, or formatter scripts are configured.

## Coding Style & Naming Conventions

Follow surrounding code: two-space indentation, semicolons, single-quoted JavaScript strings, CommonJS `require`/exports, and existing `var`/function patterns. Use camelCase for variables and functions, and short lowercase module names such as `inventory.js`. Keep unrelated modernization out of focused fixes. Preserve explicit monetary rounding and existing API response shapes unless the change requires otherwise.

## Testing Guidelines

There is no test directory, testing framework, coverage threshold, or established test naming convention. For new automated tests, use descriptive `*.test.js` names and document the runner command. Manually verify affected flows: order creation/cancellation, stock updates, coupon limits, GST totals, khata balances, reports, and printable invoices. Record steps and results in the PR. Back up `data/db.json` before mutation checks; avoid committing incidental test data.

## Commit & Pull Request Guidelines

History uses short, lowercase, descriptive subjects, such as `invoice page for accountant`, without Conventional Commit prefixes. Keep commits focused. PRs should describe the problem, resulting behavior, verification performed, and any configuration or datastore impact. Link relevant issues and include screenshots for UI or invoice changes.
