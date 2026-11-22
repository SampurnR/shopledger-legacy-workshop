# ShopLedger

## Stack

- Node.js, CommonJS, Express 4, and body-parser.
- Browser UI uses plain HTML, CSS, and JavaScript; there is no frontend framework or build step.
- Application data is stored in `data/db.json` through synchronous file reads and writes in `lib/store.js`.

## Module map

- `server.js`: Express entry point, static UI, API router mounts, and printable invoice route.
- `config.js`: port, shop details, tax slabs, inventory defaults, coupons, and admin key.
- `routes/`: `products.js` serves catalog and coupons; `orders.js` handles order listing, placement, and cancellation; `customers.js` handles customer accounts and settlements; `reports.js` handles pricing preview, dashboard, GST reconciliation, and export.
- `lib/`: `orders.js` order lifecycle; `inventory.js` stock; `pricing.js`, `tax.js`, and `coupons.js` bill calculations; `ledger.js` customer credit and settlements; `invoice.js` printable invoices; `reports.js` summaries and reconciliation; `dates.js` date helpers; `store.js` JSON persistence and audit log.
- `public/`: browser interface (`index.html`, `css/style.css`, `js/app.js`).
- `data/db.json`: local products, customers, orders, settlements, and audit log.

## Commands

- `npm start` - runs `node server.js`.
- `npm test` - currently a placeholder that prints `no test specified` and exits with an error.
- There are no build or lint scripts in `package.json`.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`.
- Do not add dependencies.
