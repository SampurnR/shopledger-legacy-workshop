# Repository Guidelines

## Stack and Module Map

ShopLedger uses Node.js with CommonJS, Express 4, and body-parser. The UI is plain HTML, CSS, and browser JavaScript. `server.js` mounts the API routers and serves `public/`; `config.js` contains app and shop settings. In `routes/`, `orders.js` handles orders, `products.js` the catalog and coupons, `customers.js` customer and settlement endpoints, and `reports.js` reports and pricing preview. In `lib/`, `orders.js`, `inventory.js`, `pricing.js`, `tax.js`, `coupons.js`, `ledger.js`, `invoice.js`, `reports.js`, `dates.js`, and `store.js` implement the corresponding business logic and JSON-file persistence. `data/db.json` is the local data file.

## Commands

- `npm start` starts the server on port 3000 by default (or `PORT` if set).
- `npm test` currently prints `no test specified` and exits with an error; no test framework is configured.

There is no build, lint, or formatting script in `package.json`.

## Change and Test Rules

- Before changing behaviour, write characterization tests for the affected behaviour.
- Change only the module the ticket is about. Do not make unrelated or opportunistic edits.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Add no dependencies. Use the packages and runtime already available in the repository.
