# Repository Guidelines

## Current Stack

ShopLedger is a Node.js application using CommonJS JavaScript, Express 4, and body-parser. The browser interface uses plain JavaScript, HTML, and CSS. Persistence is a local JSON file, read and written synchronously; there is no database service or frontend build step.

## Module Map

- `server.js` configures Express, mounts API routes, serves static assets, and exposes printable invoices.
- `routes/` contains HTTP handlers for products, orders, customers, and reports.
- `lib/` contains pricing, coupons, GST (`tax.js`), inventory, orders, dates, ledger balances, invoices, reports, and JSON persistence (`store.js`).
- `public/` contains the HTML interface, `css/style.css`, and plain browser JavaScript in `js/app.js`.
- `data/db.json` is the writable application database, including sample records and counters.
- `config.js` holds shop details and business settings. `docs/` contains onboarding notes and an architecture image.

## Commands

- `npm install`: install Express and body-parser dependencies.
- `npm start`: run `node server.js`; open `http://localhost:3000`.
- `$env:PORT=3001; npm start`: use a different port in PowerShell.
- `node --check lib/pricing.js`: check a changed JavaScript file for syntax errors.
- `npm test`: currently exits with a placeholder error; it does not validate changes.

There is no build, lint, or formatting script, and no pinned Node.js version.

## Change Rules

- Write characterization tests before changing behaviour. Capture the module's existing outputs and edge cases, including current quirks, before implementing the ticket.
- Change only the module the ticket is about. Keep characterization tests focused on that module; avoid unrelated refactors or edits to neighbouring modules.
- Tests must never read or write `data/db.json`. Use synthetic in-memory fixtures or isolated temporary files, and stub persistence when needed.
- Add no dependencies. Use existing packages and Node.js built-ins for implementation and tests.
