# Repository Guidelines

## Stack

ShopLedger is a Node.js billing, inventory, and customer khata application using CommonJS, Express 4, and body-parser. The frontend is static HTML, CSS, and JavaScript. Persistence is a JSON file read and rewritten synchronously.

## Module Map

- `server.js`: middleware, API router mounting, static frontend serving, and printable invoice endpoint.
- `routes/`: product, order, customer, and report API handlers.
- `lib/`: orders, pricing, GST, coupons, inventory, ledgers, dates, reports, invoice rendering, and JSON storage (`store.js`).
- `public/`: `index.html`, `js/app.js`, and `css/style.css` for the frontend.
- `config.js`: port, shop details, and business defaults.
- `data/db.json`: persistent application data.

## Commands

- `npm install`: install the existing dependencies.
- `npm start`: run `node server.js` at `http://localhost:3000` by default.
- `PORT=3001 npm start`: run on port 3001.
- `node --check lib/orders.js`: check JavaScript syntax; substitute the changed file's path as needed.
- `npm test`: prints `Error: no test specified` and exits unsuccessfully; it does not validate changes.

There is no configured build, watcher, formatter, or lint command.

## Rules

- Write characterization tests that capture current behavior before changing behavior.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use isolated fixtures or in-memory data.
- Add no dependencies.
