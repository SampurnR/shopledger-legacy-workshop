# ShopLedger

ShopLedger is a CommonJS Node.js app with Express 4, body-parser, and a plain HTML, CSS, and JavaScript browser UI. The app stores its data in `data/db.json`.

- `server.js` serves `public/`, mounts the `/api` routers, and serves printable invoice HTML.
- `routes/` contains the products, orders, customers, and reports routers.
- `lib/` contains order and date handling, inventory, pricing, coupons, GST, khata, reporting, invoice rendering, and JSON persistence.
- `config.js` contains the shop, tax, coupon, inventory, and port settings.

## Commands

- `npm install` installs the existing dependencies. Keep any generated `package-lock.json` out of workshop commits.
- `npm start` serves the app on port 3000 by default. Placing an order changes the tracked JSON data file.
- `node --test` runs the built-in Node test runner. The `npm test` script is a placeholder.

## Workshop rules

- Write and run characterization tests before changing behaviour.
- Limit production code changes to the module or modules named by the ticket.
- Tests use in-memory fixtures and never touch `data/db.json`. Use a temporary project copy for manual server reproduction.
- Add no dependencies.
