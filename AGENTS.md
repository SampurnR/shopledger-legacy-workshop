# ShopLedger

ShopLedger is a CommonJS Node.js app using Express and body-parser. The browser runs plain HTML, CSS, and JavaScript. The app stores its data in `data/db.json`.

## Module map

- `server.js` serves the browser UI, mounts the API routers, and serves printable invoices.
- `routes/` contains the products, orders, customers, and reports routers.
- `lib/inventory.js` calculates sellable stock and applies stock mutations. `lib/orders.js` manages order state. `lib/ledger.js` manages Khata credit.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, and `lib/invoice.js` handle billing. `lib/dates.js` and `lib/reports.js` support order dates and reports.
- `lib/store.js` reads and writes the JSON data and appends audit entries. `config.js` contains application defaults.

## Commands

- `npm install` installs the app's existing dependencies.
- `npm start` starts the app at `http://localhost:3000` by default.
- `node --test` runs the workshop tests.

## Workshop rules

- Write passing characterization tests before changing existing behavior. Show a regression test failing before implementing the fix.
- Keep implementation changes in the modules covered by the ticket.
- Use in-memory data for tests. Keep `data/db.json` out of test runs and use a temporary checkout for manual order and cancellation checks.
- Use the project's existing dependencies.
