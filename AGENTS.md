# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and body-parser. The browser UI is plain HTML, CSS, and JavaScript. Runtime records are stored in `data/db.json`; app settings are in `config.js`. The project uses CommonJS modules.

## Module Map

- `server.js`: serves `public/`, mounts API routers, and renders the invoice page.
- `public/`: browser UI (`index.html`, `js/app.js`, `css/style.css`).
- `routes/`: Express endpoints for products, orders, customers, and reports.
- `lib/`: order and inventory logic; pricing, tax, and coupons; customer ledger; reports and invoices; date helpers; JSON-file storage.
- `config.js`: port, shop information, tax slabs, coupons, and inventory defaults.
- `data/db.json`: products, orders, customers, settlements, and audit log.

## Commands

- `npm start`: runs `node server.js` (default port 3000; configurable with `PORT`).
- `npm test`: currently prints “Error: no test specified” and exits with status 1. No test framework or build/lint command is configured.

## Contribution Rules

- Before changing behavior, write characterization tests that capture the existing behavior relevant to the change.
- Change only the module the ticket is about. Keep unrelated modules untouched.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Do not add dependencies. Use the stack and packages already present in the repository.
