# ShopLedger onboarding

Reviewed on 21 November 2026.

ShopLedger is a small shop's **billing, inventory, and customer credit (khata) app**. Staff select products, apply coupons, record cash/UPI sales or credit purchases, print invoices, cancel orders, record repayments, and review stock and GST discrepancies.

## Scope and confidence

The review inspected source and configuration and ran isolated checks against in-memory copies of the supplied data. No server was started, nothing was installed, and no application files or data were changed during that review. This document was subsequently added at the user's request.

**I am sure** means the finding follows directly from the inspected code or was reproduced in an isolated in-memory check. **I suspect** means deployment context, current external information, or business confirmation is still needed.

## I am sure: module map

The architecture is **browser → Express routes → business logic → one JSON file**. There is no separate database service or payment integration in this repository.

Paths below are relative to the repository root.

| Module | Responsibility |
|---|---|
| `public/index.html`, `public/css/style.css` | Four screens: New Order, Order History, Customer Khata, Inventory & GST Audit. |
| `public/js/app.js` | Browser state, cart, API requests, tables, checkout, cancellations, repayments. Plain JavaScript; no frontend framework. |
| `server.js` | Express entry point; serves static files, mounts `/api` routes, serves printable invoices. Port defaults to 3000. |
| `config.js` | Shop details, GST mapping, coupons, inventory settings, admin export key. |
| `routes/products.js` | Product catalogue with search/category filters and sellable stock; active coupon list. |
| `routes/orders.js` | Lists/reads orders; coordinates checkout and cancellation. |
| `routes/customers.js` | Customer balances, recent settlements, repayment submission. |
| `routes/reports.js` | Dashboard, GST reconciliation, cart pricing preview, admin data export. |
| `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js` | Subtotal, coupon validation/caps, proportional discounts, item GST, CGST/SGST split. |
| `lib/inventory.js` | Sellable stock, availability checks, stock deductions, cancellation release, stock summaries. |
| `lib/orders.js`, `lib/dates.js` | Order IDs/records, cancellation, filtering/sorting, date helpers. |
| `lib/ledger.js` | Customer credit limits, billing debits, reversals, repayments, balances. |
| `lib/invoice.js`, `lib/reports.js` | Independently recalculated printable invoices; dashboard and invoice-versus-order reconciliation. |
| `lib/store.js`, `data/db.json` | Synchronous reads/writes of the entire data file. Stores products, customers, orders, settlements, counters, and the latest 100 audit entries. |

At review time, the checked-in dataset contained 12 products, five customers, eight orders, and four settlements.

## I am sure: what happens when an order is placed

1. **Staff build a cart.** The browser loads products and customers. Changing quantities or coupons sends `POST /api/pricing/preview` for a server-calculated estimate.

2. **Checkout submits `POST /api/orders`.** The payload contains items, customer information, payment mode, fulfillment status, and coupon.

3. **The server reloads the JSON database.** It rejects an empty cart and unknown products. It takes prices, names, SKUs, and HSN codes from the catalogue, so submitted prices do not control billing. Quantities are parsed as integers; invalid or nonpositive quantities become one.

4. **Inventory is checked.** Sellable stock is physical stock minus reserved units, floored at zero. The current check also rejects buying exactly the available quantity.

5. **The coupon and totals are calculated.** Codes are trimmed and uppercased. Invalid/inactive coupons or insufficient subtotals are rejected. The discount is allocated proportionally across lines, then each line's GST is calculated on its discounted value. Monetary results are rounded to two decimals.

6. **The customer and credit account are resolved.** A registered customer's name overrides the submitted name. For `khata`, a valid customer account and sufficient credit are required; the total increases their billed amount and balance. Cash and UPI are recorded labels—there is no payment-provider confirmation.

7. **Stock and the order are updated in memory.** Physical stock is deducted immediately, including for pending orders. An order ID is allocated, a server-local `DD/MM/YYYY` date is stored, and status defaults to `completed`. The order saves aggregate totals but omits the detailed tax breakdown returned by pricing.

8. **Everything is saved together.** An audit entry is added, the entire JSON file is overwritten, and the server returns HTTP 201. The browser clears the cart and refreshes products, customer balances, and dashboard figures.

9. **Printing uses another calculation path.** `/orders/:id/invoice` recalculates invoice figures through `lib/invoice.js`. This is the source of a major inconsistency.

## I am sure: confirmed risks and stale parts

Priority labels below are review judgments based on the potential impact of the confirmed behavior.

| Priority | Finding and consequence | Evidence |
|---|---|---|
| Critical | **Settlement corrupts balances during normal UI use.** The browser submits the amount as a string, and the ledger adds it without numeric conversion. In an in-memory check, ₹1,200 already settled plus `"500"` became `"1200500"`, producing a balance of **−₹1,198,067.99**. | `public/js/app.js:549`, `lib/ledger.js:62`, especially line 71. |
| High | **Invoices disagree with recorded orders.** Invoice calculation ignores HSN slabs for normal order lines, falls back to 18%, and applies different coupon rules without the checkout caps/minimums/active checks. The supplied data yields **7 mismatches out of 8**, with **₹612.01 aggregate absolute total variance**. Order #1002 records ₹963.90 but prints ₹1,083.24. | `lib/invoice.js:15`, compared with `lib/pricing.js:25`; reproduced through `lib/reports.js:60`. |
| High | **Cancellation fails to restore stock.** Checkout deducts `stock` using item `id`; release looks for `productId` and changes `reserved`. Cancelling a supplied order left inventory unchanged in memory. | `lib/inventory.js:40`, `lib/inventory.js:50`, `lib/orders.js:33`. |
| High | **The application has no authentication or role checks.** Ordinary endpoints expose customer information and allow orders, cancellations, and repayments. Export uses a hardcoded key passed in the URL. This is confirmed at the app layer; deployment protections are unknown. | `server.js:15`, route modules, `routes/reports.js:61`, `config.js:5`. |
| High | **Stored cross-site scripting paths exist.** Customer names and settlement notes are accepted and later inserted into browser `innerHTML` without escaping. Error messages also reach `innerHTML`. | `routes/orders.js:73`, `routes/customers.js:20`, `public/js/app.js:278`, `public/js/app.js:342`, `public/js/app.js:532`. |
| High | **Inventory checks have two defects.** Buying the last available unit is rejected (`qty >= sellable`). Repeated product lines are checked independently, allowing their combined quantity to exceed stock. The ordinary UI produces one line per product, but the API accepts duplicates. | `lib/inventory.js:22`, especially line 29; `routes/orders.js:38`. Both cases checked in memory. |
| High | **Persistence has no atomic replacement or recovery mechanism.** Each save directly overwrites the database file. A failed/interrupted write can damage the only application data file. File I/O also blocks request processing. | `lib/store.js:17`, `lib/store.js:23`. External backups are unknown. |
| Medium | **Date filtering and sorting are incorrect across months/years.** They compare `DD/MM/YYYY` strings lexically. The supplied "newest first" list starts with January 30 rather than March 15. | `lib/dates.js:14`, `lib/orders.js:76`, `lib/orders.js:90`; supplied order sorting checked in memory. |
| Medium | **Validation and lifecycle controls are incomplete.** The API accepts arbitrary status/payment strings, silently repairs bad quantities, and has no idempotency protection. Pending orders deduct stock and charge khata immediately; no pending-to-completed endpoint exists. Dashboard "GST collected" includes pending and credit orders. | `routes/orders.js:43`, `routes/orders.js:72`, `routes/orders.js:83`, `routes/orders.js:93`, `lib/reports.js:21`. |
| Maintenance | **No usable automated tests or README are tracked.** `npm test` is a placeholder that fails. Node version is not pinned. The lockfile existed locally but was untracked at review time, so it was not part of the repository's reproducible setup. | `package.json`, tracked-file inventory, and `git status --short` at review time. |
| Maintenance | **Legacy assumptions remain.** Tax/coupon comments date to 2021, sample transactions end in March 2022, malformed dates default to `FY21-22`, `allowBackorder` is unused, and the commented PDF endpoint was never implemented. | `config.js`, `data/db.json`, `lib/dates.js:27`, `server.js:32`. |

## I suspect: requires verification

- **The app was intended for a trusted, single-shop environment.** Its design suggests this, but the repository does not establish the actual hosting or access controls.
- **Multiple server processes or external writers could overwrite each other's changes.** There is no locking. Within one Node process, the synchronous checkout path runs without asynchronous interleaving, so ordinary simultaneous requests alone do not prove this failure.
- **Tax mappings and invoice requirements may be outdated.** The code contains old, fixed assumptions and always splits GST into CGST/SGST. Current tax rules and whether the shop handles interstate supplies were not verified.
- **Dependencies may need updates or security fixes.** The manifest specifies `express ^4.17.1` and `body-parser ^1.19.0`; the local installation at review time actually contained **4.22.3** and **1.20.9**. Current releases and advisories were not checked, so the review does not establish that those installed versions are vulnerable.
- **Actual production data may differ from this sample.** The demonstrated defects are real code behavior; the repository alone cannot establish their production impact.
