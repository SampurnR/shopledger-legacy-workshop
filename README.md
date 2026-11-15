# ShopLedger

ShopLedger is a browser-based point-of-sale and bookkeeping app for a small retail and wholesale shop. It supports product and stock lookup, order billing, GST calculations, coupons, customer khata credit, settlements, order history, printable invoices, and dashboard reports.

## Requirements

- Node.js and npm
- Node.js 18 or newer to run the built-in `node:test` test suite

## Setup and run

Install the declared packages:

```sh
npm install
```

Start the app:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set the `PORT` environment variable to use a different port.

## Tests

Run the tests with Node's built-in test runner:

```sh
node --test
```

The current `npm test` script is a placeholder and exits with an error; use `node --test` instead. The tests use in-memory records and do not access `data/db.json`.

## Main areas

- `server.js` — Express app, static frontend hosting, API route registration, and printable invoice route.
- `config.js` — port, shop details, HSN GST slabs, inventory defaults, coupons, and admin export key.
- `public/` — HTML, CSS, and browser JavaScript for the POS, orders, customer khata, and inventory/GST audit views.
- `routes/` — Express endpoints grouped by products, orders, customers/settlements, and reports.
- `lib/` — JSON storage and audit log, order lifecycle, inventory, pricing, tax, coupons, khata ledger, invoice rendering, reports, and date helpers.
- `data/db.json` — local records for products, customers, orders, settlements, and audit history.
- `docs/architecture.svg` — architecture diagram.
- `test/` — `node:test` characterization tests for invoice and billing totals.

## API overview

All API routes are mounted under `/api`.

| Area | Endpoints |
|---|---|
| Products and coupons | `GET /api/products`, `GET /api/coupons` |
| Orders | `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `POST /api/orders/:id/cancel` |
| Customers and khata | `GET /api/customers`, `POST /api/customers/:id/settle` |
| Reports and pricing | `GET /api/reports/dashboard`, `GET /api/reports/gst-reconciliation`, `POST /api/pricing/preview` |
| Admin export | `GET /api/admin/export?key=…` |
| Printable invoice | `GET /orders/:id/invoice` |

## Order flow

The browser submits selected product IDs and quantities, customer/payment details, and an optional coupon to `POST /api/orders`. The server looks up current product prices and HSN codes, checks available stock, calculates discounts and GST, applies a khata credit limit when applicable, deducts stock, creates the order, and writes the updated records and audit entry to `data/db.json`.

Invoice figures are calculated using the same pricing rules as order billing so HSN tax slabs and coupon discounts match the billed order.

## Data and security notes

- The app reads and rewrites `data/db.json` as a single local JSON file. Back it up before running against important records.
- Most API endpoints do not have authentication. The admin export endpoint uses a key defined in `config.js`; keep the app on a trusted local network and do not expose it publicly as-is.
- Order cancellation currently has a stock-release implementation that should be reviewed before relying on cancellations to restore inventory.

