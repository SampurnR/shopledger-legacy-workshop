# Repository Guidelines

## Stack

ShopLedger is a CommonJS Node.js application using Express 4 and `body-parser`. The browser UI is plain HTML, CSS, and JavaScript; persistent application data is stored in `data/db.json`.

## Module Map

- `server.js` configures Express, serves `public/`, mounts the API routers, and serves printable invoices.
- `routes/` contains the product, order, customer, and report/pricing endpoints.
- `lib/` contains store access (`store.js`), order and inventory logic, pricing, coupons, tax, customer ledger, reports, invoice rendering, and date helpers.
- `config.js` holds shop, tax, inventory, and coupon settings. `data/db.json` holds products, orders, customers, settlements, and audit entries.
- `public/` contains the dashboard UI; `docs/` contains repository documentation and diagrams.

## Commands

- `npm start` — start the Express app on port 3000 (or `PORT` if set).
- `npm test` — currently a placeholder that exits with “no test specified”; no test framework or build script is configured.

## Change Rules

- Write characterization tests before changing behaviour. Preserve existing behaviour unless the ticket calls for a change.
- Change only the module the ticket is about. Avoid unrelated cleanup or edits across modules.
- Tests must never read from or write to `data/db.json`; use isolated fixtures or temporary data instead.
- Add no dependencies. Use the existing Node.js and browser APIs.

## Style and Commits

Follow the existing JavaScript style: CommonJS `require`/`module.exports`, two-space indentation, semicolons, and single-quoted strings. Keep route handlers in `routes/` and reusable business logic in `lib/`. Recent commit subjects are short, lowercase summaries (for example, `invoice page for accountant`); use a similarly concise subject.
