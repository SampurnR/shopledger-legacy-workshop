# Repository Guidelines

## Stack

ShopLedger is a Node.js app using CommonJS, Express 4, and `body-parser`. The browser UI uses plain HTML, CSS, and JavaScript. The app stores its records in a local JSON file.

## Module Map

- `server.js` serves the browser UI, mounts the API routers, and handles printable invoice requests.
- `routes/` handles product, order, customer, and reporting requests.
- `lib/` contains pricing, coupons, GST, invoicing, orders, inventory, khata, reporting, and date helpers. `lib/store.js` reads and writes `data/db.json`.
- `public/` contains the browser UI and static assets. `config.js` holds shop settings, GST rates, and coupon rules.

## Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js` on port 3000 by default. Set `PORT` to override it.
- `npm test` is a placeholder that exits with an error. There is no configured test suite or build step.
- `node --check path/to/file.js` checks JavaScript syntax.

## Rules for Changes

1. Write and run characterization tests that capture current behavior before changing it.
2. Change only the application module the ticket is about.
3. Tests must never read or write `data/db.json`. Use in-memory fixtures or a separate temporary file.
4. Add no dependencies, including dev dependencies.
