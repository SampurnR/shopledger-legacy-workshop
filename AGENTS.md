# Repository Guidelines

## Stack

ShopLedger is a Node.js app using CommonJS, Express, and body-parser. Its browser UI is plain HTML, CSS, and JavaScript. Application data is stored in `data/db.json` through synchronous filesystem reads and writes in `lib/store.js`.

## Module Map

- `server.js` starts Express, serves `public/`, and mounts the API routers.
- `public/` contains the POS and reporting UI.
- `routes/` contains the products, orders, customers, and reports HTTP handlers.
- `lib/` contains order, inventory, pricing, coupon, tax, ledger, reporting, invoice, date, and JSON-store logic.
- `config.js` contains app, shop, coupon, inventory, and tax settings.
- `data/db.json` contains the current products, orders, customers, settlements, and audit log.

## Commands

- `npm start` runs `node server.js`; the default port is 3000 and can be overridden with `PORT`.
- `npm test` is a placeholder that exits with “no test specified”; no test framework is configured.

There are no build, lint, or formatting commands configured.

## Change and Test Rules

- Before changing behavior, write characterization tests that capture the existing behavior.
- Change only the module the ticket is about. Do not make unrelated edits or refactors.
- Tests must never read from or write to `data/db.json`. Use isolated test data and temporary storage instead.
- Add no dependencies. Use the packages and built-in Node.js APIs already available.
