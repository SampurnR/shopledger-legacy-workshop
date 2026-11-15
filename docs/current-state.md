# Current state of ShopLedger

Verified from source and characterization tests on 2026-11-15. This describes current behavior, including the invoice GST correction.

## What the application does

This is a single-process Express application with a static browser UI. The UI has New Order, Order History, Khata Accounts, and Inventory & GST Audit views. It supports catalog search and category filtering, cart pricing previews, coupon validation, order creation and cancellation, customer settlements, dashboard summaries, printable HTML invoices, and GST reconciliation. There is no PDF export implementation; the server contains a commented-out placeholder.

Routes are mounted under `/api`: `GET /products`, `GET /coupons`, `POST /pricing/preview`, `GET /orders`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/cancel`, `GET /customers`, `POST /customers/:id/settle`, `GET /reports/dashboard`, `GET /reports/gst-reconciliation`, and `GET /admin/export`. Printable invoices use `/orders/:id/invoice` outside `/api`. The export route checks a configured key; the other listed routes have no authentication middleware. The configuration mentions admin reset, but no reset route is implemented.

All persistence uses synchronous reads and whole-file writes of `data/db.json`. There is no external database, transaction mechanism, or frontend build. `npm start` serves the app on port 3000 unless `PORT` is set.

## Verified business behavior

- Checkout resolves product prices from the catalog. Coupons are normalized, checked for minimum spend and expiry, and capped. Discounts are allocated proportionally to items before HSN-specific GST; amounts are rounded to two decimals and tax is split into CGST and SGST.
- Tax helpers accept numeric GST overrides as percentages or decimals. HSN matching is exact despite the configuration comment describing prefixes; unknown HSNs fall back to 18%.
- Sellable stock is physical stock minus reserved units, clamped at zero. Order commitment subtracts from physical stock.
- Khata billing calculates opening balance plus total billed minus total settled. A charge exactly reaching the credit limit succeeds; a charge exceeding it fails. Cancellation reverses khata billing once; repeat cancellation is rejected.
- Dashboard revenue includes pending orders and excludes cancelled orders. Cancelled orders are also excluded from invoice reconciliation.

## Known defects captured by passing tests

1. Stock checks reject a quantity equal to sellable stock. Duplicate product lines are checked separately, allowing their combined quantity to exceed stock and drive physical stock negative.
2. Cancellation passes normal order items containing `id` to a release helper expecting `productId`. Physical stock stays deducted. Even with `productId`, that helper reduces reservations instead of restoring physical stock.
3. The browser submits settlement amounts as strings, and the route passes them through. Adding `'5'` to an existing settlement total of `20` produces `'205'`; the recorded settlement amount is nevertheless numeric `5`. The computed customer balance becomes incorrect.
4. Order sorting and date filtering compare display-formatted dates lexically. For example, 31 January sorts ahead of 1 February, and can pass a lower-bound filter for 1 February.
Printable invoices now reuse checkout pricing, including HSN slabs, proportional discounts, coupon validation and caps, GST overrides, rounding, and CGST/SGST splits. For a rice line of ₹2,000 with SAVE10, checkout and invoice both total ₹1,942.50. Regression tests also verify rendered invoices and GST reconciliation.

## Current persisted data snapshot

Baseline read-only calculation from `data/db.json` before the invoice correction; the invoice mismatch figures below describe that earlier behavior, not the corrected calculation; these figures change as the app is used and are deliberately not hardcoded into tests:

| Measure | Value |
| --- | ---: |
| Products / orders / customers / settlements | 12 / 8 / 5 / 4 |
| Pending / cancelled orders | 1 / 0 |
| Dashboard gross revenue (includes pending) | ₹8,578.72 |
| Stored tax collected | ₹731.22 |
| Khata receivable | ₹5,153.51 |
| Out-of-stock / low-stock SKUs | 1 / 3 |
| Inventory valuation (physical stock at selling price) | ₹52,700.00 |
| Invoice/ledger mismatches | 7 of 8 orders |
| Sum of absolute invoice total differences | ₹612.01 |

## Verification and limits

`npm test` runs 16 characterization and regression tests with Node's built-in test runner. They use fresh in-memory fixtures and never write the persisted database. Coverage includes checkout arithmetic, coupons, tax resolution, stock boundaries and duplicate lines, credit limits, cancellation, numeric/string settlements, cross-month dates, invoice agreement across HSN slabs, coupon rules, GST overrides and rounding, rendered reconciliation notices, and report status handling.

These are business-logic characterization tests, not a browser or HTTP integration suite. Browser rendering, HTTP request validation, filesystem failure behavior, concurrent requests, and security have not been comprehensively tested. A green suite confirms the baseline, including the named defects; it does not establish production readiness.
