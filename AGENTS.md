# ShopLedger

## Stack

Node.js with CommonJS, Express 4 and body-parser. Express serves the plain HTML, CSS and JavaScript in `public/`. The application persists its state in `data/db.json`.

## Module map

- `routes/products.js` — Lists catalog products, sellable stock and active coupons.
- `routes/orders.js` — Lists, retrieves, creates and cancels orders.
- `routes/customers.js` — Lists Khata customers and records settlements.
- `routes/reports.js` — Serves dashboard and GST reconciliation reports, cart previews and database export.
- `lib/coupons.js` — Normalizes codes, checks eligibility and calculates discounts.
- `lib/dates.js` — Formats dates, normalizes filter inputs and derives fiscal years.
- `lib/inventory.js` — Looks up products, checks sellable stock and updates inventory.
- `lib/invoice.js` — Calculates invoice figures and renders printable HTML.
- `lib/ledger.js` — Manages Khata charges, reversals, balances and settlements.
- `lib/orders.js` — Creates, retrieves, filters and cancels orders.
- `lib/pricing.js` — Allocates discounts and calculates line GST and order totals.
- `lib/reports.js` — Summarizes the dashboard and compares invoice and ledger figures.
- `lib/store.js` — Reads and writes the JSON store and records audit entries.
- `lib/tax.js` — Resolves GST rates and splits GST into CGST and SGST.

## Commands

- Start the app with `npm start` (defaults to port 3000).
- Run tests with `node --test`.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the modules the ticket is about.
3. Tests use in-memory data and never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed. Allowed implementation files are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
