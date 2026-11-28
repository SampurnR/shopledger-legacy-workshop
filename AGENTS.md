# ShopLedger workshop notes

## Stack and commands
- Node.js and Express, with `body-parser`; persistent data is JSON in `data/db.json`.
- Install dependencies with `npm install`.
- Start the app with `npm start` (http://localhost:3000).
- Run tests with `node --test`.

## Module map
- `server.js` mounts the static UI, API routers, and printable invoice route.
- `routes/` contains the product, order, customer, and report HTTP handlers.
- `lib/` contains storage, inventory, order, pricing, coupon, tax, invoice, ledger, date, and report logic.
- `config.js` holds shop settings, tax slabs, coupons, and the port; `data/db.json` is the JSON database.
- `public/` contains the browser UI, CSS, and client JavaScript.

## Rules
- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`; use in-memory data.
- Add no dependencies.
