# Repository Guidelines

## Stack

ShopLedger uses Node.js, CommonJS, Express 4, and `body-parser`. The browser UI uses plain HTML, CSS, and JavaScript. The app persists its state in a JSON file.

## Module Map

- `server.js` serves the UI, mounts the API under `/api`, and exposes the printable invoice route.
- `routes/` contains the product, order, customer, and report routers.
- `lib/` contains order, inventory, pricing, coupon, tax, khata ledger, invoice, report, date, and storage logic.
- `public/` contains the browser UI. `config.js` holds shop settings and business defaults. `data/db.json` is the app's data store.

## Commands

- `npm install` installs the declared dependencies.
- `npm start` runs the app on port 3000 by default. Set `PORT` to override it.
- `npm test` runs a placeholder that exits with an error. No test framework is configured.
- `node --check routes/orders.js` checks JavaScript syntax. The UI requires no build step.

## Contributor Rules

- Write characterization tests that capture current behaviour before changing it.
- Change only the module the ticket is about.
- Tests must never read, write, or otherwise touch `data/db.json`. Use isolated fixtures or temporary files.
- Add no dependencies.
