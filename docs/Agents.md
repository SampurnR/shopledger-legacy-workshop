# ShopLedger

## Stack

ShopLedger is a CommonJS Node.js app using Express and body-parser. Express serves a plain HTML, CSS, and JavaScript frontend. The app persists its state in `data/db.json` through `lib/store.js`.

## Module map

- `server.js` serves the UI, mounts the API routers, and handles the printable invoice endpoint.
- `public/` contains the POS, order register, Khata, and audit views.
- `routes/` contains the products and coupons, orders, customers, and reports routers. The reports router also serves the cart pricing preview.
- `lib/orders.js`, `lib/inventory.js`, and `lib/ledger.js` handle orders, stock, and customer credit.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` handle checkout totals, coupon rules, and GST.
- `lib/invoice.js` recomputes figures for printable invoices. `lib/reports.js` provides dashboard totals and compares invoice figures with stored order totals.
- `lib/dates.js` provides date helpers. `lib/store.js` reads and writes the JSON store and appends audit entries.
- `config.js` defines shop settings, GST rates, coupons, and inventory defaults.

## Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` starts the Express server on `PORT` or port 3000 by default.
- `node --test` runs the test suite. The `npm test` script is a placeholder that exits with an error.

## Rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Use in-memory test data. Tests must never read or write `data/db.json`.
- Add no dependencies.
