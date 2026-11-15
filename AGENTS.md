# ShopLedger workshop notes

## Stack and commands
- Node.js CommonJS application using Express and a JSON file store.
- Start with `npm start` (the current local config uses port 8000).
- Run tests with `node --test`.

## Module map
- `public/` contains the browser UI.
- `routes/` contains order, product, customer, and report API routers.
- `lib/` contains pricing, tax, coupons, invoice, order, inventory, ledger, reports, date, and store logic.
- `config.js` holds shop, tax, coupon, and inventory settings.
- `data/db.json` is the application's persisted data.

## Working rules
- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use in-memory fixtures.
- Add no dependencies.
