# ShopLedger

## Stack

- Node.js with CommonJS JavaScript, Express 4, and body-parser.
- Plain HTML, CSS, and browser JavaScript served from `public/`.
- Local JSON persistence in `data/db.json`, accessed synchronously through `lib/store.js`.
- No build step or configured test framework.

## Module map

- `server.js`: Express setup, static files, API router mounting, and printable invoice endpoint.
- `config.js`: port, shop details, tax slabs, inventory settings, and coupon configuration.
- `routes/`: product and coupon endpoints, order creation and cancellation, customer settlements, reports, pricing preview, and admin export.
- `lib/orders.js`, `lib/inventory.js`, `lib/ledger.js`: order lifecycle, stock reservations, and customer credit accounts and settlements.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`: totals, coupon validation and discounts, and GST calculations.
- `lib/invoice.js`, `lib/reports.js`, `lib/dates.js`: printable invoices, dashboard and GST reports, and date helpers.
- `lib/store.js`: JSON reads and writes, data structure defaults, and audit entries.
- `public/index.html`, `public/js/app.js`, `public/css/style.css`: browser interface and API calls.

## Commands

- `npm install`: install the declared dependencies.
- `npm start` (or `node server.js`): start the app on port 3000 by default; `PORT` overrides the port.
- `npm test`: currently a placeholder that prints `Error: no test specified` and exits with status 1. No test suite is configured.

## Rules

- Write characterization tests that capture current behaviour before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read, write, or otherwise touch `data/db.json`. Use independent in-memory fixtures and stub persistence where needed.
- Add no dependencies.
