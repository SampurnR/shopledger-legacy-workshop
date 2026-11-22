# Repository Guidelines

## Stack and Module Map

ShopLedger is a Node.js application using CommonJS, Express, and `body-parser`. Its browser interface uses plain HTML, CSS, and JavaScript. Application data is stored in `data/db.json`.

- `server.js` configures Express, serves `public/`, mounts routers, and renders the invoice page.
- `routes/` contains the products, orders, customers, and reports API handlers.
- `lib/` contains order, inventory, pricing, tax, coupon, ledger, report, invoice, date, and JSON-store logic.
- `public/` contains the POS and related screens (`index.html`, `js/app.js`, `css/style.css`).
- `config.js` contains port, shop, tax, coupon, and inventory settings.

## Commands

- `npm start` runs `node server.js` (port 3000 by default; override with `PORT`).
- `npm test` currently exits with an error because it is an unconfigured placeholder; no automated test suite exists.

There are no build, lint, or formatting commands configured.

## Change and Test Rules

- Before changing behavior, write characterization tests that capture the current behavior.
- Change only the module the ticket is about. Keep unrelated modules untouched.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Do not add dependencies.

## Style

Follow the existing JavaScript style: two-space indentation, single quotes, semicolons, and CommonJS `require`/`exports`. Use descriptive lowercase filenames, such as `lib/pricing.js`. No formatter or linter is configured.
