# ShopLedger Project Notes

## Stack

- Node.js with CommonJS modules.
- Express 4 and `body-parser` provide the HTTP server and JSON request parsing.
- The browser UI is static HTML, CSS, and vanilla JavaScript using `XMLHttpRequest`.
- Application data is stored in `data/db.json`; `lib/store.js` reads and writes that file.

## Module map

- `server.js`: configures Express, serves `public/`, mounts API routes, and serves printable invoices.
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, `routes/reports.js`: HTTP handlers mounted under `/api`.
- `lib/store.js`: JSON file persistence and audit log.
- `lib/orders.js`, `lib/inventory.js`, `lib/ledger.js`: order, stock, and customer-credit behavior.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: totals, GST, and discounts.
- `lib/reports.js`, `lib/invoice.js`, `lib/dates.js`: reports, invoice rendering, and date helpers.
- `config.js`: port, shop information, tax slabs, inventory defaults, and coupon definitions.
- `public/index.html`, `public/css/style.css`, `public/js/app.js`: browser interface.

## Useful commands

- `npm start` - start the Express application (`PORT` defaults to 3000).
- `node --test test/inventory-cancellation.test.js` - run the inventory cancellation regression tests.
- `git diff --check` - check tracked changes for whitespace errors.
- `git status --short` - inspect repository changes.

The `npm test` script is currently a placeholder that exits with an error; use the direct `node --test` command for the regression suite.

## Change and test rules

- Write characterization tests before changing behavior.
- Change only the module relevant to the ticket.
- Tests must never modify `data/db.json`; use in-memory fixtures and do not call `store.write()` from tests.
- Do not add dependencies.
