# ShopLedger project notes

## Stack
- Node.js with CommonJS modules.
- Express 4 serves the browser UI from `public/` and API routes under `/api`.
- `data/db.json` is the application's persistent JSON store.
- Runtime dependencies are declared in `package.json`; do not add dependencies for workshop work.

## Module map
- `public/`: browser UI (`index.html`, `js/app.js`, `css/style.css`).
- `server.js`: Express setup, static UI, API routers, and printable invoice route.
- `routes/`: product/coupon, order, customer/settlement, and reports endpoints.
- `lib/`: business logic for coupons, dates, inventory, invoices, ledger, orders, pricing, reports, JSON storage, and tax.
- `config.js`: port, shop settings, tax slabs, coupons, inventory defaults, and admin key.
- `data/db.json`: products, orders, customers, settlements, and audit records.

## Commands
- `npm install`: install the dependencies listed in `package.json`.
- `npm start`: start the server; open `http://localhost:3000`.
- `node --test`: run Node's built-in test runner.
- The existing `npm test` script is a placeholder that exits with an error; use `node --test` for these workshop tests.

## Workshop rules
- Write characterization tests before changing behavior; record current behavior, including incorrect behavior.
- Change only the module or modules the selected ticket concerns.
- Tests must use in-memory data and must never read from or write to `data/db.json`.
- Add no dependencies.
