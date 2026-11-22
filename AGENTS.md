# Stack

- Node.js with CommonJS modules.
- Express 4 serves the static `public/` UI and mounts JSON API routers; `body-parser` parses JSON requests.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- The browser UI uses HTML, CSS, and JavaScript (`public/index.html`, `public/css/style.css`, `public/js/app.js`).

# Module map

## `routes/`
- `routes/customers.js` — lists customers and records customer settlements.
- `routes/orders.js` — lists, fetches, places, and cancels orders.
- `routes/products.js` — lists products and active coupons.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export endpoints.

## `lib/`
- `lib/coupons.js` — normalizes, validates, calculates, and lists coupons.
- `lib/dates.js` — supplies today’s date, normalizes date keys, and determines fiscal years.
- `lib/inventory.js` — finds products, checks/reserves/releases stock, and summarizes inventory.
- `lib/invoice.js` — computes invoice figures and renders printable invoice HTML.
- `lib/ledger.js` — lists customers and manages Khata charges, reversals, and settlements.
- `lib/orders.js` — adds, retrieves, cancels, and lists orders.
- `lib/pricing.js` — calculates item subtotals, coupon discounts, and totals using `lib/tax.js`.
- `lib/reports.js` — calculates dashboard summaries and GST reconciliation.
- `lib/store.js` — reads and writes `data/db.json` and appends audit entries.
- `lib/tax.js` — resolves item GST rates/slabs and splits GST into CGST and SGST.

# Commands

- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test` (Node’s built-in test runner; no test files are present currently, and `npm test` is a placeholder).

# Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; they use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

# Current ticket

Invoice total and GST breakdown do not match what the customer was billed.

Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
