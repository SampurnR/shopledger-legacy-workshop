# ShopLedger

ShopLedger is an internal wholesale and retail POS for billing, inventory, customer credit (khata), and GST invoices.

## Tech stack

- Node.js with CommonJS modules, Express 4 (`^4.17.1`), and `body-parser` (`^1.19.0`).
- Static HTML, CSS, and vanilla JavaScript. Express serves the browser files directly from `public/`.
- File-backed persistence in the tracked `data/db.json`, read and written synchronously by `lib/store.js`.

## Module map

- `public/` contains the POS cart, order register, khata settlement screen, and reports UI.
- `server.js` serves the UI, mounts the API under `/api`, and serves printable invoices. `config.js` defines the port, shop details, tax rates, coupons, and inventory defaults.
- `routes/products.js` serves the catalog and coupons. `routes/orders.js` handles checkout and cancellation. `routes/customers.js` handles khata accounts and settlements. `routes/reports.js` serves the dashboard, GST reconciliation, pricing preview, and export.
- `lib/orders.js`, `lib/inventory.js`, and `lib/ledger.js` manage order records, stock, and customer credit. `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` calculate checkout totals.
- `lib/invoice.js` renders invoices, `lib/reports.js` builds reports, `lib/dates.js` handles dates, and `lib/store.js` handles persistence and audit entries.

## Commands

Run from the repository root.

| Task | Command | Notes |
| --- | --- | --- |
| Install | `npm install` | Installs dependencies declared in `package.json`. |
| Start | `npm start` | Runs `node server.js`. Open `http://localhost:3000` by default. `PORT` can override the port. |
| Test | `npm test` | The current script prints `Error: no test specified` and exits with code 1. It is a placeholder. |

## Workshop rules

- Write characterization tests before changing behavior. Run them against the existing implementation to capture its behavior before editing it.
- Keep the fix scoped to the ticket. Leave unrelated behavior and refactors for separate work.
- Keep tests away from the tracked `data/db.json`. Use in-memory fixtures or a temporary test store so tests never read or write the tracked file.
- Add no dependencies, including test dependencies.
