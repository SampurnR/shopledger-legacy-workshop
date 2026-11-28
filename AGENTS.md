# ShopLedger contributor notes

## Stack

- Node.js application using CommonJS modules.
- Express 4 with `body-parser` serves the API and the static files in `public/`.
- The browser UI uses HTML, CSS, and vanilla JavaScript.
- Application data is stored in `data/db.json` through `lib/store.js`.
- Runtime dependencies are `express` and `body-parser`.

## Module map

- `server.js` creates the Express app, serves `public/`, mounts the routers, and serves HTML invoices.
- `routes/products.js` serves products and coupons; `routes/orders.js` handles order creation and cancellation; `routes/customers.js` serves customers and records settlements; `routes/reports.js` serves dashboard/reconciliation data and pricing previews.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` calculate order prices, discounts, and tax.
- `lib/orders.js`, `lib/inventory.js`, and `lib/ledger.js` handle order records, stock, and customer credit/settlements.
- `lib/invoice.js` renders invoices; `lib/reports.js` computes dashboard and reconciliation figures; `lib/dates.js` handles date utilities; `lib/store.js` reads and writes JSON data.
- `config.js` contains server, shop, tax, inventory, and coupon configuration.
- `public/index.html`, `public/css/style.css`, and `public/js/app.js` make up the browser UI.

## Commands

- `npm start` runs `node server.js`.
- `npm test` currently runs a placeholder that prints “Error: no test specified” and exits with failure; there is no configured test suite.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Add no dependencies.
