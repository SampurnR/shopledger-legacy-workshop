# Repository guide

## Stack

- Node.js application using CommonJS modules.
- Express 4 serves the static browser UI and JSON API; `body-parser` parses JSON request bodies.
- The UI is plain HTML, CSS, and browser JavaScript in `public/`.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- There are no development dependencies or configured test framework.

## Module map

- `server.js`: creates the Express app, serves `public/`, mounts the API routers, and renders the printable invoice route.
- `routes/`: HTTP handlers for products/coupons, orders, customers/settlements, and reports/pricing preview/export.
- `lib/`: business logic for coupons, dates, inventory, invoices, khata ledger, orders, pricing, reports, JSON storage, and GST.
- `config.js`: shop settings, tax slabs, inventory defaults, and coupons.
- `data/db.json`: local products, orders, customers, settlements, audit log, and ID counters.
- `public/`: browser interface (`index.html`), client behavior (`js/app.js`), and styling (`css/style.css`).
- `docs/architecture.svg`: application architecture diagram.

## Commands

- `npm start` — starts the server on port 3000, or the port set by `PORT`.
- `npm test` — currently a placeholder that exits with an error because no test suite is configured.

## Change rules

- Before changing behavior, write characterization tests for the existing behavior.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`.
- Do not add dependencies.
