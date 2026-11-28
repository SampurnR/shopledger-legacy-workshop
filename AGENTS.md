# Repository guide

## Stack

- Legacy Node.js application using CommonJS modules.
- Express 4 serves the API and static files from `public/`.
- Request JSON parsing uses `body-parser`.
- Application data is stored in `data/db.json` through `lib/store.js`.
- The browser UI is plain HTML, CSS, and JavaScript; there is no frontend build step.

## Module map

- `server.js`: creates the Express app, mounts route modules, serves the printable invoice, and starts the server.
- `config.js`: port, shop details, tax slabs, inventory defaults, and coupon configuration.
- `routes/`: API handlers for products and coupons, orders and pricing workflows, customers and settlements, and reports/admin export.
- `lib/`: application logic for JSON storage/audit logging, orders, inventory, khata ledger, pricing, coupons, tax, reports, invoice rendering, and date handling.
- `public/`: the browser app (`index.html`, `js/app.js`, `css/style.css`).
- `data/db.json`: the application's local data file.
- `docs/architecture.svg`: architecture diagram.

## Commands

- `npm start` — run the server with Node (`node server.js`); default port is 3000, overridable with `PORT`.
- `npm test` — currently a placeholder that exits with an error because no test command is configured.

## Rules for changes

- Before changing behaviour, write characterization tests that capture the current behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
