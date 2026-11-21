# Repository Guidelines

## Stack

ShopLedger runs on Node.js with CommonJS, Express 4, and body-parser. The browser UI uses plain HTML, CSS, and JavaScript. The app stores its data in a JSON file.

## Module Map

- `server.js` serves the UI from `public/`, mounts the API under `/api`, and serves printable invoices.
- `routes/products.js` lists products and coupons. `routes/orders.js` handles order creation, lookup, and cancellation. `routes/customers.js` handles khata accounts and settlements. `routes/reports.js` handles dashboards, GST reconciliation, cart previews, and data export.
- `lib/` contains order, inventory, khata, pricing, coupon, tax, date, invoice, and reporting logic. `lib/store.js` reads and writes `data/db.json`.
- `config.js` holds the port, shop details, GST rates, inventory defaults, and coupon rules.

## Commands

- `npm install` installs the declared dependencies.
- `npm start` runs `node server.js` on port 3000 by default. Set `PORT` to override it.
- `node --check routes/orders.js` checks JavaScript syntax. Substitute the file you changed.
- `npm test` is a placeholder that exits with an error. There is no configured build or lint command.

## Contributor Rules

1. Write characterization tests that capture existing behavior before changing it.
2. Change only the module the ticket is about.
3. Tests must never read from or write to `data/db.json`. Use in-memory fixtures or temporary files.
4. Add no dependencies.
