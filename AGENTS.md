# ShopLedger Codex instructions

## Stack and commands

- Node.js, CommonJS, Express, JSON file storage in `data/db.json`.
- Install dependencies with `npm install` and start with `npm start`.
- Run the built-in Node test runner with `node --test`.
- The app is served at `http://localhost:3000`.
- Orders mutate `data/db.json`; use an isolated temporary copy for manual checkout or cancellation flows.
- Do not commit `package-lock.json` created by setup.

## Module map

- `server.js` serves `public/`, mounts the API routers, and renders printable invoices.
- `routes/` contains product, order, customer, and report endpoints.
- `lib/store.js` reads/writes the JSON database; `lib/orders.js` manages order records.
- `lib/inventory.js` manages sellable stock and reservations; `lib/ledger.js` handles customer credit and settlements.
- `lib/tax.js` resolves HSN GST rates; `lib/coupons.js` validates and computes discounts; `lib/pricing.js` computes checkout totals.
- `lib/invoice.js` computes and renders tax invoices; `lib/reports.js` builds dashboard and GST reconciliation summaries.
- `config.js` holds shop, tax, inventory, and coupon configuration. `data/db.json` holds sample data.
- `public/index.html`, `public/css/style.css`, and `public/js/app.js` implement the browser interface.

## Safe change rules

1. Write characterization tests before changing behaviour.
2. Change only the module the ticket is about, plus its tests and required documentation.
3. Tests must use in-memory data and must never read or mutate `data/db.json`.
4. Add no dependencies.
5. Review the diff and run all tests before opening a pull request.
