# ShopLedger

## Stack

Node.js with CommonJS JavaScript, Express 4, and body-parser. The frontend is static HTML, CSS, and vanilla JavaScript served by Express. Persistence is a local JSON file at `data/db.json`, read and written synchronously by `lib/store.js`. There is no build step or configured test suite.

## Module map

- `server.js`: Express setup, static files, API route mounting, and printable invoice endpoint.
- `config.js`: port, shop details, tax slabs, inventory settings, and coupon configuration.
- `routes/`: product/coupon, order, customer/settlement, report, pricing preview, and admin HTTP endpoints.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: order totals, GST calculations, and coupon rules.
- `lib/inventory.js`, `lib/orders.js`, `lib/ledger.js`: stock operations, order lifecycle/filtering, and customer khata accounts/settlements.
- `lib/invoice.js`, `lib/reports.js`, `lib/dates.js`: printable invoices, dashboard/GST reconciliation, and date utilities.
- `lib/store.js`: JSON persistence, default data structure, and audit entries.
- `public/`: browser UI (`index.html`, `css/style.css`, `js/app.js`).
- `docs/architecture.svg`: architecture diagram.

## Commands

- `npm ci`: install dependencies from the lockfile.
- `npm start`: run `node server.js`; defaults to port 3000.
- `PORT=3001 npm start`: run on a different port.
- `npm test`: currently prints "Error: no test specified" and exits with status 1.

## Rules

- Write characterization tests capturing current behaviour before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read, write, or otherwise touch `data/db.json`; use isolated fixtures or in-memory data.
- Add no dependencies.
