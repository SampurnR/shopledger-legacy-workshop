# ShopLedger

ShopLedger is an internal billing, inventory, and customer credit (Khata) app for a kirana and wholesale shop. It provides a browser point of sale, order history, printable GST invoices, customer settlements, and dashboard and reconciliation reports.

## Requirements

- Node.js
- Dependencies from `package.json` installed in `node_modules/`

## Run

```sh
npm install
npm start
```

The server listens on port `3000` by default. Set the `PORT` environment variable to use another port.

## Tests

Run the Node.js test suite with:

```sh
node --test
```

`npm test` is currently a placeholder and exits with an error.

## Project map

- `server.js` starts Express, serves the browser UI, mounts the API routers, and serves printable invoices.
- `routes/` contains product, order, customer, and report API handlers.
- `lib/` contains order, pricing, coupon, tax, inventory, ledger, invoice, report, date, and storage modules.
- `config.js` contains shop details and application settings.
- `public/` contains the HTML, CSS, and browser JavaScript UI.
- `data/db.json` is the JSON file used for application data. It is read and written synchronously by `lib/store.js`.

## API overview

- `GET /api/products` and `GET /api/coupons` provide catalog and coupon data.
- `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, and `POST /api/orders/:id/cancel` handle order operations.
- `GET /api/customers` and `POST /api/customers/:id/settle` handle Khata accounts and settlements.
- `GET /api/reports/dashboard`, `GET /api/reports/gst-reconciliation`, and `POST /api/pricing/preview` provide reports and a pricing preview.
- `GET /orders/:id/invoice` serves a printable HTML invoice.

The project has no configured automated test framework beyond the built-in `node:test` runner; its package `test` script is not configured to run it yet.
