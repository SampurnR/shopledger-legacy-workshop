# Repository Guidelines

## Technology and Module Map

ShopLedger uses Node.js with CommonJS JavaScript, Express 4, and `body-parser`. The browser UI is plain HTML, CSS, and JavaScript under `public/`. `server.js` configures Express and mounts the API routers in `routes/`: `products.js`, `orders.js`, `customers.js`, and `reports.js`. Reusable logic is in `lib/`: `store.js` handles JSON persistence; `orders.js` and `inventory.js` handle order and stock operations; `pricing.js`, `tax.js`, and `coupons.js` calculate totals; `ledger.js` handles customer credit and settlements; `reports.js`, `invoice.js`, and `dates.js` provide reporting, invoice rendering, and date helpers. Business settings are in `config.js`; local application data is in `data/db.json`.

## Development and Test Commands

- `npm start` — runs `node server.js` (port 3000 by default; `PORT` overrides it).
- `npm test` — verified script, but it is a placeholder that prints an error and exits with status 1. No test framework or test files are configured.

## Change and Test Practices

- Before changing behavior, write characterization tests that capture the current behavior, then add or update tests for the intended behavior.
- Keep each ticket’s changes limited to the module directly related to it. Change another module only when the ticket requires that dependency; explain why in the change summary.
- Tests must never read, access, or modify `data/db.json`. Use isolated temporary data or stubs for persistence tests.
- Do not add dependencies. Use the packages and runtime facilities already present.
- Match nearby style: CommonJS `require`/`exports`, `var`, semicolons, and two-space indentation. Keep route handling in `routes/` and reusable business logic in `lib/`.
