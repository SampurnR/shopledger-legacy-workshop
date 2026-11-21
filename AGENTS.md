# Project guide

## Stack

- Node.js with CommonJS modules.
- Express 4 and `body-parser` serve the app and JSON API.
- The UI is plain HTML, CSS, and browser JavaScript under `public/`.
- `data/db.json` is the file-backed data store, accessed through `lib/store.js`.
- There is no test framework or test suite configured today.

## Module map

- `server.js`: creates the Express app, serves `public/`, mounts API routers, and serves printable order invoices.
- `routes/`: `products.js` serves product and coupon data; `orders.js` handles order operations; `customers.js` handles customers and settlements; `reports.js` handles dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/`: `store.js` reads/writes JSON and appends audit entries; `orders.js` manages orders; `inventory.js` handles stock; `pricing.js`, `tax.js`, and `coupons.js` calculate order amounts; `ledger.js` handles customer credit and settlements; `reports.js` builds reports; `invoice.js` renders invoice HTML; `dates.js` provides date helpers.
- `config.js`: port, shop details, tax slabs, inventory settings, and coupon definitions.
- `public/`: `index.html`, `js/app.js`, and `css/style.css` make up the browser UI.
- `data/db.json`: products, orders, customers, settlements, and audit log.

## Commands

- `npm start` — runs `node server.js`.
- `npm test` — currently exits with “Error: no test specified”; no test command is configured.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data.
- Add no dependencies.
