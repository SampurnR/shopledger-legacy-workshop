# ShopLedger

ShopLedger is a wholesale and retail point-of-sale app with inventory, GST invoicing, and Khata customer credit. It runs on Node.js with Express 4 and `body-parser` for JSON requests. The frontend uses plain HTML, CSS, and JavaScript. The app stores its data in the tracked `data/db.json` file.

## Module map

| Path | Responsibility |
| --- | --- |
| `server.js` | Serves the UI, mounts routers under `/api`, and serves printable invoices. |
| `public/` | Browser UI for checkout, order history, inventory, Khata, and GST reconciliation. |
| `routes/` | Express routers for products and coupons, orders, customers and settlements, and reports and pricing preview. |
| `lib/orders.js`, `lib/inventory.js`, `lib/dates.js`, `lib/ledger.js` | Order records, stock, date handling, and Khata balances. |
| `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`, `lib/invoice.js`, `lib/reports.js` | Checkout totals, GST, coupons, printable invoices, and reports. |
| `config.js`, `lib/store.js`, `data/db.json` | Shop settings, JSON persistence, and application data. |

## Commands

- `npm install` installs the existing dependencies and may generate a `package-lock.json`. Leave that generated file out of workshop commits.
- `npm start` starts the app at `http://localhost:3000` by default. Placing an order updates the tracked data file.
- `npm test` currently exits with `Error: no test specified`.

## Workshop rules

- Write characterization tests that capture current behavior before changing it.
- Limit production code changes to the module or modules covered by the chosen ticket.
- Tests must never read or write the repository's `data/db.json`. Use in-memory fixtures or temporary test data.
- Add no dependencies.
