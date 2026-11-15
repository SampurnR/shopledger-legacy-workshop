# ShopLedger

ShopLedger is a Node.js and Express 4 app with a plain HTML, CSS, and JavaScript frontend. The workshop uses Node.js 22 or newer.

## Module map

- `server.js` serves the browser UI, mounts the API routers, and serves printable invoices.
- `public/` contains the POS, order history, Khata, and audit screens.
- `routes/` contains the product, order, customer, and report API handlers.
- `lib/` handles inventory, pricing, coupons, tax, orders, dates, Khata, invoices, reporting, and storage.
- `config.js` supplies shop, GST, coupon, and inventory settings. `lib/store.js` reads and writes `data/db.json`.

## Commands

- `npm install` installs the existing dependencies.
- `npm start` runs the app at `http://localhost:3000` by default.
- `node --test` runs the workshop tests once added. The existing `npm test` script is a placeholder.

## Workshop rules

- Write and run characterization tests for current behavior before changing it. Capture a failing test for the expected behavior before applying the fix.
- Limit production code changes to the modules involved in the chosen ticket.
- Use in-memory fixtures for tests. Never read or write the tracked `data/db.json` from tests.
- Add no dependencies. Keep the `package-lock.json` generated during setup out of the workshop commit.
