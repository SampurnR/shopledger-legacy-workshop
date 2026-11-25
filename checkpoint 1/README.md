# Checkpoint 1: ShopLedger Codebase Review

## Scope and method

This is a read-only source review of the supplied `shopledger-legacy-workshop-main.zip`. The archive was inspected without extraction. No packages were installed, no tests were run, and the app was not started. Findings describe the shipped source; runtime and deployment behavior were not exercised.

## Executive summary

ShopLedger is a small Node.js/Express point-of-sale and bookkeeping app for a retail/wholesale shop. The browser UI talks to JSON APIs; business records live in one `data/db.json` file. It supports order entry, coupon and HSN-based GST calculations, inventory, customer credit (Khata) and settlements, printable invoices, and summary/reconciliation reports.

Several defects affect billing or inventory correctness: the stock guard rejects the last available units, cancellation does not restore stock, date filters/sorting compare day-first strings lexically, string settlement amounts can concatenate, and invoice calculations do not match checkout calculations. The code also contains a hard-coded admin key and uses unsafe HTML insertion for some API-provided values.

## Module map

| Area | Files | Responsibility |
|---|---|---|
| Startup and configuration | `server.js`, `config.js` | Creates the Express app, serves static files, mounts API routes, serves invoice HTML, and configures shop details, tax slabs, coupons, inventory defaults, and an admin key. |
| Persistent data | `data/db.json`, `lib/store.js` | Seed database and synchronous JSON-file read/write helpers. Stores products, customers, orders, settlements, audit events, and ID counters. |
| Product and coupon API | `routes/products.js` | Returns catalog data with sellable stock and GST rate, plus active coupons. |
| Order API and lifecycle | `routes/orders.js`, `lib/orders.js` | Lists/looks up orders, validates and records orders, filters/sorts order history, and handles cancellation. |
| Inventory | `lib/inventory.js` | Computes sellable stock, checks availability, deducts stock, attempts release on cancellation, and creates inventory summaries. |
| Pricing and tax | `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js` | Calculates subtotal, coupon discount, per-line GST, CGST/SGST, and cart totals. |
| Customer credit | `routes/customers.js`, `lib/ledger.js` | Lists customer balances, charges Khata orders, reverses Khata charges on cancellation, and records settlements. |
| Dates | `lib/dates.js` | Formats today's date, transforms date strings, and calculates fiscal-year labels. |
| Invoices and reports | `lib/invoice.js`, `lib/reports.js`, `routes/reports.js` | Renders printable invoices, dashboard KPIs, GST reconciliation, cart pricing preview, and database export. |
| Browser UI | `public/index.html`, `public/js/app.js`, `public/css/style.css` | POS and tabs for order history, Khata, inventory audit, and GST reconciliation. Calls the APIs and renders their responses. |

### HTTP endpoints

- `GET /api/products`, `GET /api/coupons`
- `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `POST /api/orders/:id/cancel`
- `GET /api/customers`, `POST /api/customers/:id/settle`
- `GET /api/reports/dashboard`, `GET /api/reports/gst-reconciliation`
- `POST /api/pricing/preview`
- `GET /api/admin/export?key=...`
- `GET /orders/:id/invoice`

## Order placement walkthrough

1. On initial page load, `public/js/app.js` fetches products, customers, dashboard summary, and GST reconciliation.
2. The cashier picks products and quantities, customer, payment mode, status, and optional coupon. The browser requests a pricing preview through `POST /api/pricing/preview`; the server resolves product prices and HSN from its own data.
3. Submission calls `POST /api/orders`. The route reads the JSON store, looks up each product, and builds order lines from server-side product fields. Client-supplied prices are not used.
4. The route checks stock and validates the coupon, then `lib/pricing.js` computes subtotal, discount, and GST. `lib/tax.js` chooses a rate from the item's `gstRate` or HSN mapping.
5. For Khata, the route requires a customer ID and asks `lib/ledger.js` to check the credit limit and increase billed balance.
6. The route deducts stock, adds an order with the next ID, appends an audit event, and rewrites `data/db.json`.
7. On success, the UI clears the cart and refreshes data. The invoice link invokes `lib/invoice.js`, which independently recalculates the figures.

## I am sure

The following findings are directly visible in the source.

### Correctness and data integrity

- **Last-unit sales fail.** `lib/inventory.js` rejects a line when `qty >= sellable`; equality should be allowed for an order that uses exactly the remaining stock.
- **Cancellation does not return stock.** Order lines use `id`, but `lib/inventory.js` looks them up with `productId`. In addition, `reserve()` subtracts from `stock`, while `release()` only subtracts from `reserved`; it never adds units back to `stock`.
- **Duplicate lines can overdraw inventory.** Availability is checked per line without aggregating quantities for identical product IDs. A crafted API request can submit multiple individually acceptable lines whose combined quantity exceeds stock.
- **Bad quantities are coerced to 1.** `routes/orders.js` uses `parseInt` and replaces falsy or below-one values with 1. Thus zero, negative, absent, and invalid quantities are not rejected; decimals and numeric prefixes are truncated.
- **Order status is not allowlisted by the API.** The UI presents completed and pending, but the API stores any supplied status. A direct request can create an order marked cancelled while still applying inventory/Khata side effects.
- **Date comparisons are not chronological.** `lib/dates.js` converts ISO date input to `DD/MM/YYYY`; `lib/orders.js` then uses string comparisons for ranges and newest-first sorting. Day-first strings do not sort lexicographically by calendar date.
- **Settlement totals can concatenate strings.** The UI sends the input amount as a string. `lib/ledger.js` adds it directly to `totalSettled`, which can concatenate (for example, `1200 + "500"` becomes `"1200500"`).
- **Invoice totals can disagree with checkout.** `lib/invoice.js` falls back to 18% GST when `gstRate` is absent instead of resolving the stored HSN. Its percentage discount is based on subtotal plus tax and does not apply coupon min/max rules. The reconciliation report calls this same invoice calculator.
- **The store is a single synchronous JSON file.** Each mutation reads and rewrites the whole file with synchronous filesystem calls. This blocks the Node event loop and has no transactional or backup/recovery layer in the application code.
- **No tests or project README are present in the archive.** The `npm test` script is a placeholder that exits with an error.

### Security and access control

- **Hard-coded export credential.** `config.js` contains an admin key. `GET /api/admin/export` checks it from a query parameter and returns the entire database. The key is exposed to anyone who can read the source, and query strings can be captured in logs/history.
- **No authentication is implemented in the shipped routes.** The ordinary product, order, customer, settlement, and reporting routes do not check a user identity or role.
- **Potential stored HTML/script injection.** `public/js/app.js` writes API-provided values into `innerHTML`. Order/customer names and settlement notes are accepted by API routes and later rendered. This is an unsafe sink; exploitability depends on the app being accessed by another user in the same browser origin.
- **Sensitive fields exist in the JSON seed data.** It includes customer phone numbers, GSTINs, balances, and order/payment records. Avoid treating the file as harmless demo data without confirming its provenance.

### Legacy/reproducibility indicators

- The package is `shopledger` version `0.8.4`; dependency declarations use older ranges (`express ^4.17.1`, `body-parser ^1.19.0`).
- There is no package lockfile in the archive, so exact dependency versions are not pinned.
- Comments date code additions to 2021. A config comment references an admin reset route, but no such route appears in the shipped source. The PDF endpoint is also explicitly unfinished/commented out.
- I did not install/audit dependencies, so I have not confirmed resolved versions or specific published vulnerabilities.

## I suspect

These points depend on deployment or business context and cannot be settled from the archive alone.

- The app appears intended for a trusted, single-shop environment. If exposed to an untrusted network, the unauthenticated write routes could allow changes to orders, inventory, and balances. The source alone does not show firewall, proxy, or hosting protections.
- Multiple server processes could lose updates because they independently read and rewrite the same JSON file. A single Node process handles synchronous route work sequentially, so the multi-process risk depends on deployment.
- The shop identity, tax settings, coupon policies, and HSN rules may be sample or historical values. Have the accountant confirm tax behavior before relying on printed invoices.
- Dependency age is a maintenance concern, but a lockfile and dependency audit are needed to establish actual installed versions and concrete vulnerability exposure.
- The seed records may be synthetic, but their contact and financial fields look sensitive enough to treat carefully until confirmed.

## Review limits

This is a static review of the supplied ZIP, not a runtime verification. I did not run tests, install packages, start the server, inspect a live deployment, or verify tax policy with the business.
