# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS modules. Its browser UI uses HTML, CSS, and vanilla JavaScript. The app persists records in a JSON file.

## Module Map

- `server.js`: configures Express, serves `public/`, mounts routers, and serves invoice pages.
- `routes/`: API endpoints for products, orders, customers, and reports.
- `lib/`: order, inventory, pricing, tax, coupon, ledger, report, invoice, date, and store logic.
- `public/`: browser interface and its assets.
- `config.js`: port, shop details, tax slabs, inventory defaults, and coupons.
- `data/db.json`: file-backed application records.

## Commands

- `npm start`: start the server (`PORT` overrides the default port 3000).
- `npm test`: currently prints “no test specified” and exits with failure; no test suite is configured.

## Change Rules

- Before changing behavior, write characterization tests that capture the existing behavior.
- Change only the module the ticket is about. Do not make unrelated edits in other modules.
- Tests must never read from or write to `data/db.json`; use isolated test data.
- Do not add dependencies. Use the existing runtime and packages.
