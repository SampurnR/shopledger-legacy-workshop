# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS JavaScript. The browser UI is plain HTML, CSS, and JavaScript. Application data is stored in `data/db.json`.

## Module Map

- `server.js` creates the Express app, serves `public/`, mounts routes, and renders invoice pages.
- `routes/` contains the products, orders, customers, and reports API handlers.
- `lib/` contains order, inventory, pricing, tax, coupon, ledger, report, invoice, date, and JSON store logic.
- `public/` contains `index.html`, `js/app.js`, and `css/style.css`.
- `config.js` contains port, shop, tax, inventory, and coupon settings.
- `data/db.json` contains the JSON-backed application data.

## Commands

- `npm start` runs `node server.js` (port 3000 by default; `PORT` can override it).
- `npm test` currently prints “no test specified” and exits with an error; no test suite is configured.

There is no build, lint, or formatting command configured in `package.json`.

## Change Rules

- Before changing behaviour, write characterization tests that capture the current behaviour.
- Change only the module the ticket is about. Keep unrelated modules untouched.
- Tests must never read from or write to `data/db.json`; use isolated test data.
- Do not add dependencies.
