# Repository Guidelines

## Stack

ShopLedger runs on Node.js with CommonJS, Express 4, and body-parser 1. The browser UI uses plain HTML, CSS, and JavaScript. The app persists its data in a local JSON file.

## Module Map

- `server.js` serves the UI, mounts the API under `/api`, and serves printable HTML invoices.
- `routes/` contains the products, orders, customers, and reports routers.
- `lib/` contains pricing, coupons, GST, inventory, orders, khata credit, invoices, reporting, date helpers, and storage.
- `public/` contains the browser UI and assets.
- `config.js` holds shop, tax, and coupon settings. `lib/store.js` reads and writes `data/db.json`.

## Commands

- `npm install` installs the existing dependencies.
- `npm start` runs the app on port 3000 by default. Set `PORT` to use another port.
- `node --check lib/pricing.js` checks JavaScript syntax. Substitute the file you changed.
- `npm test` currently runs a placeholder that exits with status 1. The repository has no configured test suite.

## Contributor Rules

- Write characterization tests that capture current behavior before changing it.
- Change only the application module the ticket is about, alongside its characterization tests.
- Tests must never read or write `data/db.json`. Use in-memory fixtures or separate temporary files.
- Add no dependencies.

## Additional Rules

do not commit or make any git chnages insted give me comand i will do it 


