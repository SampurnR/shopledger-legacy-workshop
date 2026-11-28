# CP1: Read-only explanation

**Folder inspected:** `/Users/chetan/Desktop/shopledger-legacy-workshop`  
**Mode:** read-only. No files changed, no packages installed, and no server started during this checkpoint.

## What the app does

ShopLedger is a Node.js and Express point-of-sale application for a grocery and wholesale shop. It shows products and sellable stock, calculates GST and coupons during checkout, stores orders and customer credit balances in a JSON file, renders tax invoices, and exposes reporting and reconciliation screens.

## Module map

- `server.js`: configures Express, static assets, API routers, and the printable invoice endpoint.
- `public/`: browser UI for POS, orders, customer Khata, inventory, and GST audit.
- `routes/products.js`: product and coupon APIs.
- `routes/orders.js`: order listing, checkout, cancellation, and pricing preview.
- `routes/customers.js`: customer list and settlement API.
- `routes/reports.js`: dashboard, GST reconciliation, and preview API.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout totals, GST slabs, and coupon rules.
- `lib/invoice.js`: printable invoice calculation and HTML.
- `lib/inventory.js`: sellable-stock checks and stock adjustments.
- `lib/ledger.js`: Khata balances and settlements.
- `lib/orders.js`, `lib/dates.js`, `lib/reports.js`: order workflow, dates, and reporting.
- `lib/store.js`: JSON persistence through `data/db.json`.
- `config.js`: shop, GST, inventory, and coupon configuration.

## Order placement walkthrough

1. The browser sends selected product IDs, quantities, coupon, payment mode, and customer data to `POST /api/orders`.
2. `routes/orders.js` reads the JSON database, resolves product details, checks stock, validates the coupon, and calls `lib/pricing.js`.
3. Pricing apportions the coupon across items and calculates GST from HSN slabs via `lib/tax.js`.
4. Khata orders update the customer ledger. The route deducts stock, creates an order, appends an audit event, and writes the complete database back to `data/db.json`.
5. The printable invoice endpoint reads that stored order and renders it through `lib/invoice.js`.

## I am sure

- The app has no pre-existing automated tests or README.
- Production-style data lives in the tracked `data/db.json` file and write routes overwrite that file.
- The application uses Express 4, Node.js CommonJS modules, and no database service.
- Checkout calculations and invoice calculations originally lived in different modules.

## I suspect

- Writing to one JSON file makes concurrent requests vulnerable to lost updates.
- The hard-coded admin key in `config.js` is unsafe if this repository is exposed beyond the workshop.
- Input validation and authorization appear minimal for an app that handles inventory and customer balances.
- Legacy comments indicate abandoned or incomplete functionality, including a PDF invoice endpoint.
