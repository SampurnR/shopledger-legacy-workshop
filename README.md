# ShopLedger

ShopLedger is an Express-based point-of-sale and back-office app for a small retail and wholesale shop. The browser UI supports order entry, order history, customer Khata (credit) accounts, inventory visibility, and sales/GST reporting.

For a visual overview, see [the architecture diagram](docs/architecture.svg).

## Requirements

- Node.js
- npm

Dependencies are declared in `package.json`.

## Run locally

From this directory:

```sh
npm install
npm start
```

The app listens on port `3000` by default. Set `PORT` to use another port. Open `http://localhost:3000` in a browser.

The app reads and writes `data/db.json` directly. Keep a backup before running it against important shop data.

## Tests

```sh
node --test
```

Tests use the built-in `node:test` runner and in-memory data; they never read or write `data/db.json`.

## Main areas

| Path | Responsibility |
| --- | --- |
| `server.js` | Creates the Express app, serves `public/`, and mounts routers. |
| `config.js` | Port, shop identity, GST defaults and HSN slabs, inventory settings, coupon definitions, and admin export key. |
| `public/` | POS, order history, Khata, and inventory/GST audit browser UI. |
| `routes/products.js` | Product catalog, active coupons. |
| `routes/orders.js` | Create, list, retrieve, and cancel orders. |
| `routes/customers.js` | Customer list and Khata settlements. |
| `routes/reports.js` | Dashboard, GST reconciliation, pricing preview, and admin export. |
| `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js` | Order totals, GST, and coupon calculations. |
| `lib/inventory.js` | Product lookup, sellable stock checks, and inventory changes. |
| `lib/orders.js` | Order record creation, lookup, listing, and cancellation. |
| `lib/ledger.js` | Customer credit balances, order debits, and settlements. |
| `lib/invoice.js` | Printable HTML invoice generation. |
| `lib/reports.js` | Dashboard summary and invoice/order GST reconciliation. |
| `lib/dates.js` | Indian `DD/MM/YYYY` storage dates and date helpers. |
| `lib/store.js` | Reads/writes `data/db.json` and maintains the audit log. |
| `data/db.json` | Local JSON data for products, orders, customers, settlements, counters, and audit entries. |

## Order flow

1. The browser loads products and customers through the API and requests live cart totals from `POST /api/pricing/preview`.
2. On submission, the browser sends product IDs, quantities, customer/payment details, status, and coupon to `POST /api/orders`.
3. The order router resolves product details from stored data, checks stock and coupon validity, then calls pricing, tax, inventory, and (for Khata) ledger logic.
4. The order is added to the data object, an audit entry is prepended, and the entire object is written to `data/db.json`.
5. The UI can open `/orders/:id/invoice` for a printable invoice. Order history and audit views use the reporting and listing endpoints.

## API overview

- `GET /api/products`, `GET /api/coupons`
- `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `POST /api/orders/:id/cancel`
- `GET /api/customers`, `POST /api/customers/:id/settle`
- `GET /api/reports/dashboard`, `GET /api/reports/gst-reconciliation`, `POST /api/pricing/preview`
- `GET /api/admin/export?key=...`
- `GET /orders/:id/invoice` (printable HTML)

## Data and date formats

Order dates are stored as `DD/MM/YYYY`. Date filters from HTML date inputs use `YYYY-MM-DD`; `lib/dates.js` converts them to `DD/MM/YYYY` before comparing. IDs are allocated from counters stored in `data/db.json`.

## Operational notes

- This is a file-backed app: each request reads and writes the full JSON document. It is intended for a small, single-process workflow rather than concurrent multi-instance use.
- `config.js` contains an admin export key and shop/GST details. Configure deployment access appropriately and replace example credentials and business details before using real data.
- `npm test` is currently a placeholder that exits with an error; run `node --test` instead.
