# CP1 | Understand before changing

Project folder: `shopledger`  
Mode at this checkpoint: **read-only**  
Baseline commit: `68c85a9`  
Selected ticket: [SampurnR/shopledger-legacy-workshop#1](https://github.com/SampurnR/shopledger-legacy-workshop/issues/1)

This is an exported Codex explanation. It is not a screenshot of the Codex UI.
During the initial inspection no application files were changed, packages
installed or server started. This document was saved after that inspection.

## What the app does

ShopLedger is a small wholesale and retail billing desk. Staff select products,
apply coupons, take cash/UPI or charge a customer credit account (Khata), and
print an invoice. Separate views show order history, settlements, inventory and
GST reconciliation. It is a synthetic legacy project supplied for the workshop.

## Module map

| Boundary | Files and responsibility |
| --- | --- |
| Browser | `public/index.html`, `public/js/app.js`, `public/css/style.css`: four tabs and API calls |
| Composition | `server.js`: static files, four `/api` routers and printable invoice endpoint |
| Catalog | `routes/products.js`: products and coupons |
| Orders | `routes/orders.js`: list/get/create/cancel |
| Credit accounts | `routes/customers.js`: accounts and settlements |
| Reporting | `routes/reports.js`: dashboard, reconciliation, pricing preview and keyed export |
| Money | `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: discounted line GST and eligibility |
| Invoice | `lib/invoice.js`: a separate calculation and HTML rendering |
| Operations | `lib/inventory.js`, `lib/orders.js`, `lib/ledger.js`, `lib/dates.js` |
| Aggregation | `lib/reports.js`: invoice/ledger comparisons and dashboard |
| Persistence | `lib/store.js` reads/writes `data/db.json` synchronously |
| Configuration | `config.js`: port, shop, HSN slabs, coupon rules and legacy admin key |

## What happens when an order is placed

1. Browser posts selected product IDs/quantities, customer, payment and coupon.
2. `routes/orders.js` reads the JSON store and resolves trusted catalog prices,
   names, SKU and HSN values. It does not accept the browser's prices.
3. `inventory.check` verifies sellable stock (physical minus reserved units).
4. `coupons` normalizes and validates the code; `pricing.computeTotals` applies
   discount caps, apportions discounts and calculates post-discount HSN GST.
5. For Khata, `ledger.chargeOrderToKhata` checks the account and credit limit.
6. `inventory.reserve` deducts physical units; `orders.add` assigns an ID/date.
7. `store.appendAudit` records the event and `store.write` persists the database.
8. The UI refreshes. Printing later enters `invoice.render`, while the audit
   compares `invoice.computeInvoiceFigures` against the saved ledger figures.

## I am sure

- The original project has no README or tests; `npm test` deliberately fails.
- Checkout already implements HSN slabs and coupon caps in shared modules.
- Invoice calculation duplicates older rules: default 18% GST, tax before
  discounts, percentage discount on subtotal plus GST and no eligibility/cap.
- Sample orders #1001-#1007 mismatch; #1008 matches. For #1002, invoice total is
  INR 1083.24 and GST INR 183.60; saved total is INR 963.90 and GST INR 45.90.
- The other two tickets concern inventory/cancellation and date/settlement logic.
- The source contains an admin key and an export endpoint guarded by that key.
  It has no user login middleware. Do not expose this sample app publicly.

## I suspect / requires separate investigation

- Whole-file synchronous persistence can lose updates under concurrent requests;
  no concurrency reproduction was attempted at CP1.
- Browser string-built HTML may permit injection; exploitability was not tested.
- Dependency ranges target older major versions. An installation/audit would be
  needed to establish the currently resolved versions and vulnerabilities.
- Recomputing historical orders with mutable coupon/tax configuration can change
  old invoices. This ticket does not introduce immutable pricing snapshots.

## Decision and boundaries

Fix ticket #1 by removing divergent calculation from `lib/invoice.js` and reusing
the checkout engine. Demonstrate seven mismatches becoming zero without changing
stored charges. Keep other production modules unchanged. First characterize
existing behaviour, then show red regressions, then fix and review.
