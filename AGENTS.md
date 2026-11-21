# Repository guidance

## Stack

- Node.js application using CommonJS modules.
- Express 4 with `body-parser` for JSON request bodies.
- Browser UI is static HTML, CSS, and vanilla JavaScript served from `public/`.
- `data/db.json` is the file-backed store, accessed through `lib/store.js`.

## Module map

- `server.js` creates the Express app, serves the UI, mounts the API routers, and serves printable invoices. `config.js` holds the port, shop details, tax slabs, coupons, and inventory defaults.
- `routes/` exposes product and coupon lookup (`products.js`), order operations (`orders.js`), customer and settlement operations (`customers.js`), and reporting, price preview, and export (`reports.js`).
- `lib/` contains persistence (`store.js`), orders (`orders.js`), inventory (`inventory.js`), customer credit (`ledger.js`), pricing (`pricing.js`), coupons (`coupons.js`), tax (`tax.js`), dates (`dates.js`), reporting (`reports.js`), and invoice rendering (`invoice.js`).
- `public/` contains the single-page UI: `index.html`, `js/app.js`, and `css/style.css`.
- `data/db.json` contains products, customers, orders, settlements, audit entries, and ID counters.

## Commands

- `npm start` starts the server with `node server.js`.
- `npm test` is currently a placeholder that exits with an error; there is no configured test suite.

## Change rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`.
- Do not add dependencies.
