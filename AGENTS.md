# ShopLedger

## Stack

Node.js with CommonJS, Express 4, and `body-parser` for JSON requests. The frontend uses plain HTML, CSS, and JavaScript. The app stores its data in `data/db.json`.

## Module map

- `server.js` starts the app, serves `public/`, mounts the API routes, and serves printable invoices. `config.js` holds app and shop settings.
- `routes/` contains the product and coupon, order, customer ledger, reporting, pricing preview, and admin export endpoints.
- `lib/store.js` reads and writes `data/db.json`. The other `lib/` modules handle orders, pricing, coupons, GST, inventory, invoices, the customer ledger, reports, and date helpers.
- `public/` contains the browser UI.

## Commands

- `npm install` installs the declared dependencies.
- `npm start` runs the app on port `3000` by default. Set `PORT` to use another port.
- `npm test` is a placeholder that prints `Error: no test specified` and exits with status 1.

## Rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`.
- Add no dependencies.
