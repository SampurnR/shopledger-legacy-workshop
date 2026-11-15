# ShopLedger development instructions

## Current stack

- JavaScript on Node.js, using CommonJS (`require`, `module.exports`, `exports`).
- Express 4 and `body-parser` for HTTP routing, static files, and JSON request bodies; these are the only direct dependencies in `package.json`.
- Plain HTML, CSS, and browser JavaScript with direct DOM updates and `XMLHttpRequest` for JSON API calls.
- Local JSON persistence in `data/db.json`, read and rewritten synchronously through Node's `fs` by `lib/store.js`.
- Cash, UPI, and khata are recorded payment modes; the application does not integrate a payment gateway.

## Module map

See [docs/architecture.svg](docs/architecture.svg) for the detailed architecture and order placement flow.

| Location | Responsibility |
| --- | --- |
| `public/index.html`, `public/js/app.js`, `public/css/style.css` | Static UI for POS/cart, order history and cancellation, customer khata settlements, dashboard, inventory, and GST audit. |
| `server.js` | Creates and exports the Express app; configures JSON parsing, serves `public/`, mounts all four routers at `/api`, and serves printable HTML at `/orders/:id/invoice`. Listens only when run directly. |
| `routes/products.js` | Product catalog with filters, sellable stock and GST rates; active coupon listing. |
| `routes/orders.js` | Order listing, retrieval, creation, and cancellation; coordinates stock, pricing, khata, audit, and persistence. |
| `routes/customers.js` | Customer balances and recent settlements; records settlements and persists audit/data updates. |
| `routes/reports.js` | Dashboard, GST reconciliation, cart pricing preview, and admin-key-protected JSON export. |
| `lib/pricing.js` | Subtotals, coupon discount allocation, per-line tax, and rounded cart totals. |
| `lib/tax.js` | Explicit GST rate overrides, HSN slab lookup, fallback rate, and CGST/SGST split. |
| `lib/coupons.js` | Coupon normalization, lookup, validation, discount calculation, and active listing. |
| `lib/inventory.js` | Product lookup, sellable-stock checks, stock deductions, reservation release, and inventory summary. |
| `lib/orders.js` | Order IDs and snapshots, retrieval/filtering, cancellation, and calls to inventory release and khata debit reversal. |
| `lib/ledger.js` | Customer balances, credit-limit checks, order debits/reversals, and settlement recording. |
| `lib/invoice.js` | Independent invoice tax/discount calculations and printable HTML rendering. |
| `lib/reports.js` | Dashboard aggregates and reconciliation of stored order figures against invoice calculations. |
| `lib/dates.js` | Local date strings, date-filter normalization, and fiscal-year labels. |
| `lib/store.js` | JSON database reads/writes, missing-collection defaults, and audit entries. |
| `config.js` | Port (`PORT` environment variable or `3000`), shop metadata, tax slabs/fallback, inventory settings, coupons, and export admin key. |
| `data/db.json` | Protected application data: products, orders, customers, settlements, audit log, and ID counters. |
| `package.json`, `package-lock.json` | npm scripts, dependencies, and resolved dependency lockfile. |

## Development commands

Run commands from the repository root. Installation and server commands below are reference instructions; do not run them merely to inspect or update this file.

| Task | Verified command or availability |
| --- | --- |
| Install dependencies | `npm install` (reference only; uses `package.json` and `package-lock.json`). |
| Run application | `npm start` invokes `node server.js`; default URL is `http://localhost:3000`, with port configurable through `PORT`. |
| Build | Unavailable: no build script or build configuration; Express serves the frontend files directly. |
| Tests | `npm test` exists but only prints `Error: no test specified` and exits with status 1. No application tests or test runner are configured. |
| Lint | Unavailable: no lint script or linter configuration. |
| Format | Unavailable: no formatting script or formatter configuration. |

No CI workflows are present in the repository.

## Mandatory engineering rules

### Characterization tests first

- Before changing existing behaviour, write characterization tests that capture the current behaviour.
- Understand existing tests before modifying implementation. The current test script is a placeholder; do not treat it as a passing test suite.
- Ensure changes do not unintentionally break existing functionality.

### Module scope control

- Change only the module that the ticket is about.
- Avoid unrelated refactoring or changes to other modules.
- If a requirement genuinely necessitates changes outside the target module, explain why before proceeding.

### Data safety

- Tests must NEVER modify `data/db.json`. Treat it as protected application data.
- Use isolated fixtures, mocks, or temporary test data. Ensure tests cannot overwrite, truncate, or mutate the actual JSON database.
- `lib/store.js` hardcodes the database path and rewrites the entire file. Isolate or mock persistence before testing routes or code that can call `store.write`; temporary test data must never be redirected onto the real database path.

### Dependency management

- Do NOT add new dependencies. Prefer existing libraries and utilities.
- Do not modify package manifests or lockfiles to introduce dependencies.

## Additional guidelines

- Follow existing conventions: two-space indentation, semicolons, single-quoted JavaScript strings, CommonJS backend modules, and the surrounding function/`var` style.
- Prefer minimal, targeted changes; reuse existing functionality and avoid changing unrelated files.
- Handle errors and edge cases, and add or update tests for new functionality while respecting data safety and dependency rules.
- Do not silently change existing API contracts, including request/response shapes, status codes, and defaults.
