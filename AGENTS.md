# Stack
- Node.js CommonJS app using Express 4 and body-parser; entry point is `server.js`.
- Data persistence uses the JSON file at `data/db.json` through `lib/store.js`.

# Module map
- `routes/customers.js` — customer listing and Khata settlement endpoints.
- `routes/orders.js` — order listing, lookup, creation, and cancellation endpoints.
- `routes/products.js` — product and active coupon endpoints.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export endpoints.
- `lib/coupons.js` — coupon normalization, lookup, validation, discount calculation, and active listing.
- `lib/dates.js` — today, date normalization, and fiscal year helpers.
- `lib/inventory.js` — product lookup, sellable stock, stock checks, deduction, release, and summary.
- `lib/invoice.js` — invoice calculations and printable HTML rendering.
- `lib/ledger.js` — customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` — order creation, lookup, cancellation, and filtering.
- `lib/pricing.js` — subtotal, discount, and order total calculations.
- `lib/reports.js` — dashboard and GST reconciliation calculations.
- `lib/store.js` — JSON store read/write and audit log append.
- `lib/tax.js` — GST rate resolution and CGST/SGST splitting.

# Commands
- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test` (the current `package.json` test script is a placeholder and exits with an error).

# Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; they use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

# Current ticket
Cannot sell the last sellable unit in stock, and cancelling an order never restores stock.
Allowed files: `lib/inventory.js`, and `lib/orders.js` (`cancel` only).
