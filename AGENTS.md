# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and body-parser 1.
- Express serves plain HTML, CSS, and browser JavaScript from `public/`.
- `lib/store.js` reads and writes `data/db.json` synchronously.

## Module map

- `routes/customers.js` lists Khata accounts and records settlements.
- `routes/orders.js` lists, fetches, creates, and cancels orders.
- `routes/products.js` serves the product catalog and active coupons.
- `routes/reports.js` serves the dashboard, GST reconciliation, cart price preview, and database export.
- `lib/coupons.js` normalizes codes, checks eligibility, and calculates discounts.
- `lib/dates.js` supplies order dates, sortable date keys, and fiscal years.
- `lib/inventory.js` looks up products, checks sellable stock, adjusts stock and holds, and summarizes inventory.
- `lib/invoice.js` calculates invoice figures and renders printable HTML.
- `lib/ledger.js` tracks customer balances, credit limits, order charges, reversals, and settlements.
- `lib/orders.js` creates, retrieves, filters, and cancels order records.
- `lib/pricing.js` calculates checkout subtotals, discounts, per-line GST, and totals.
- `lib/reports.js` builds the dashboard summary and compares invoice figures with saved order figures.
- `lib/store.js` reads and writes the JSON database and appends audit entries.
- `lib/tax.js` resolves GST rates and splits GST into CGST and SGST.

## Commands

- Start the app with `npm start`, which runs `node server.js`. The default port is `3000`.
- Run tests with `node --test`. The repository currently has no test files, and `npm test` is a placeholder.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the application modules the ticket is about.
3. Use in-memory data in tests. Never read or write `data/db.json` in tests.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

The printable invoice total and GST breakdown do not match what the customer was billed. Checkout uses `lib/pricing.js` to calculate the stored order totals. The printable invoice recalculates them separately in `lib/invoice.js`.

Allowed application files are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
