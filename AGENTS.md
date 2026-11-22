# ShopLedger

## Stack

- Node.js with CommonJS modules, Express 4, and body-parser for JSON requests.
- Static HTML, CSS, and browser JavaScript served by Express.
- File-backed JSON storage in `data/db.json`.

## Module map

- `routes/customers.js` lists customer accounts and records Khata settlements.
- `routes/orders.js` lists, retrieves, creates, and cancels orders.
- `routes/products.js` lists and filters products and lists active coupons.
- `routes/reports.js` serves the dashboard, GST reconciliation, cart pricing preview, and admin export.
- `lib/coupons.js` normalizes coupon codes, validates eligibility, and calculates discounts.
- `lib/dates.js` formats dates, normalizes date strings, and derives fiscal years.
- `lib/inventory.js` computes sellable stock, checks availability, updates inventory, and summarizes stock.
- `lib/invoice.js` computes invoice figures and renders printable HTML invoices.
- `lib/ledger.js` manages Khata balances, credit checks, order debits and reversals, and settlements.
- `lib/orders.js` assigns order IDs, stores and filters orders in memory, and handles cancellation.
- `lib/pricing.js` calculates checkout subtotals, allocated discounts, line taxes, and totals.
- `lib/reports.js` builds dashboard metrics and compares invoice figures with recorded order figures.
- `lib/store.js` reads and writes the JSON database and appends audit entries.
- `lib/tax.js` resolves GST rates and splits tax into CGST and SGST.

## Commands

- Start the app with `npm start`, which runs `node server.js`.
- Run tests with `node --test`. There are currently no project test files. The `npm test` script is a failing placeholder.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the modules the ticket is about.
3. Tests must never read or write `data/db.json`. Use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed.

Allowed implementation files are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
