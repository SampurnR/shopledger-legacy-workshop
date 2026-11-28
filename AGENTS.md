# ShopLedger workshop guidance

## Current stack and layout

- Node.js with Express; the browser UI is plain HTML, CSS, and JavaScript.
- `server.js` serves `public/` and mounts the routers in `routes/`.
- `routes/` contains `products.js`, `orders.js`, `customers.js`, and `reports.js`.
- `lib/` contains `orders.js`, `inventory.js`, `pricing.js`, `coupons.js`, `tax.js`, `ledger.js`, `reports.js`, `invoice.js`, `dates.js`, and `store.js`.
- `data/db.json` is the application's JSON data store.

## Commands

- `npm start` starts the local server.
- `node --test` runs the built-in Node.js test runner.

## Workshop rules

- Write characterization tests before changing behavior.
- Change only the module covered by the selected ticket.
- Tests must use in-memory data and must never read or write `data/db.json`.
- Add no dependencies.
