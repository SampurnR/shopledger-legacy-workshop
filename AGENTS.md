# ShopLedger

ShopLedger is an internal retail and wholesale billing app with inventory, printable GST invoices, and a khata customer credit ledger.

## Stack

- Node.js with CommonJS, Express 4, and `body-parser` for JSON requests.
- Static HTML, CSS, and browser JavaScript served by Express.
- A local JSON data file at `data/db.json`.

## Module map

- `server.js` serves the UI from `public/`, mounts the API, and serves printable invoices.
- `routes/products.js` serves the catalog and coupons. `routes/orders.js` creates, lists, completes, and cancels orders. `routes/customers.js` handles customer accounts and settlements. `routes/reports.js` handles pricing previews, reports, and export.
- `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate checkout totals. `lib/orders.js`, `lib/inventory.js`, and `lib/ledger.js` handle orders, stock, and customer balances.
- `lib/invoice.js` renders invoices. `lib/reports.js` builds reports. `lib/dates.js` handles dates. `lib/store.js` reads the JSON data file, replaces it atomically on updates, and appends audit entries.
- `config.js` holds shop details, tax rates, inventory defaults, and coupon settings.

## Commands

- `npm start` runs `node server.js`. The default address is `127.0.0.1:3000`. `HOST` and `PORT` override it.
- Set `SHOPLEDGER_STAFF_PASSWORD` in the environment and sign in as `staff`. To enable full export, set a different `SHOPLEDGER_ADMIN_PASSWORD` and sign in as `admin`. Serve remote access over HTTPS.
- Run `npm test` or `node --test` for the isolated test suite.
- Order API clients must send an `Idempotency-Key` header on creation and reuse it for retries of that submission. The browser supplies it automatically.
- A new pending-dispatch order holds stock. Completing it posts the sale and enables invoicing. Pending orders saved by the old workflow were billed at placement.
- If a process dies while holding the JSON writer lock, stop all writers and verify the data file before removing the stale `db.json.lock` sidecar.

## Rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never read, write, or replace `data/db.json`. Use isolated test data.
