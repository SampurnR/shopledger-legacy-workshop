# CP1 — Explain (read-only inspection)

Working directory: `C:\Users\prabh\Downloads\shopledger-legacy-workshop`.
This is the actual ShopLedger repository; no folder rename is required.
Selected ticket: Ticket 1 — invoice total and GST breakdown differ from customer billing.

## I am sure

ShopLedger is a Node.js/Express, CommonJS wholesale/retail POS with stock reservations,
coupon pricing, customer Khata credit accounts, order history, printable invoices,
and a GST reconciliation dashboard. The browser uses static HTML/CSS/JavaScript.
Persistence is one synchronous JSON file, not a database service.

### Complete module map

| File | Responsibility / relevant functions |
| --- | --- |
| public/index.html | POS, order history, Khata and inventory/GST audit views |
| public/js/app.js | Browser requests, cart preview, placement and table rendering |
| public/css/style.css | Static interface styling |
| server.js | Express entry point, static assets, four /api routers, GET /orders/:id/invoice |
| routes/products.js | GET /products and /coupons; stock and tax metadata |
| routes/orders.js | GET list/detail, POST placement and cancellation |
| routes/customers.js | Customer balances and POST settlement |
| routes/reports.js | Dashboard, GST reconciliation, pricing preview and keyed export |
| lib/coupons.js | normalizeCode, validate, calculateDiscount, active coupon listing |
| lib/dates.js | today, normalizeDateKey, getFiscalYear |
| lib/inventory.js | find, getSellableStock, check, reserve, release, summarize |
| lib/invoice.js | computeInvoiceFigures and printable HTML render |
| lib/ledger.js | Customer lookup/listing, chargeOrderToKhata, reverseOrderDebit, recordSettlement |
| lib/orders.js | add, get, list and cancel orders |
| lib/pricing.js | subtotal, discount, computeTotals; checkout calculation authority |
| lib/reports.js | getDashboardSummary and getGstReconciliation |
| lib/store.js | read, write, appendAudit; fixed path to data/db.json |
| lib/tax.js | getRateForItem, getSlabPercent, splitCgstSgst |
| config.js | Port, shop metadata, GST slabs, inventory defaults and coupon definitions |
| data/db.json | Products, orders, customers, settlements, audit log and next-ID counters |

### Complete order-placement flow

1. `public/js/app.js` sends selected product IDs/quantities and coupon to
   POST `/api/pricing/preview`. `routes/reports.js` resolves current products,
   validates the coupon and calls `pricing.computeTotals` for the preview.
2. The Place Order handler sends items, customer/customerId, paymentMode, status
   and coupon to POST `/api/orders`, mounted by `server.js`.
3. `routes/orders.js` calls `store.read`, rejects an empty cart, looks up each
   product with `inventory.find`, parses quantities and creates item snapshots
   including current price, SKU and HSN. Invalid/non-positive quantities become 1.
4. `inventory.check` checks sellable stock (physical minus reserved). Today it
   incorrectly rejects quantities equal to available stock (Ticket 2, untouched).
5. `coupons.normalizeCode` and `validate` check activity and minimum subtotal.
6. `pricing.computeTotals` applies `coupons.calculateDiscount` caps to subtotal,
   apportions the discount per line, rounds line taxable amounts, resolves HSN
   with `tax.getRateForItem`, calculates rounded GST, and splits CGST/SGST.
7. Registered customer IDs resolve through `ledger.findCustomer`. Khata payment
   requires an account and `chargeOrderToKhata` checks credit before charging it.
8. `inventory.reserve` deducts physical stock. `orders.add` assigns the next ID,
   date, item snapshots and subtotal/discount/tax/total, then appends the order.
9. `store.appendAudit` adds ORDER_CREATED; `store.write` persists the full JSON.
   The route returns HTTP 201 and the browser refreshes stock/dashboard/accounts.

### Ticket 1 flow and confirmed source differences

`server.js` GET `/orders/:id/invoice` reads an order and calls `invoice.render`.
`render` invokes `computeInvoiceFigures`. The reconciliation endpoint uses
`reports.getGstReconciliation`, which invokes that same invoice calculation and
compares its total and tax with stored ledger figures.

The original invoice code ignores HSN when gstRate is absent, using 18% instead;
calculates tax before discount; calculates percent discounts on subtotal plus tax;
and bypasses coupon caps, minimums, activity and normalization. Checkout uses the
different shared pricing/coupon/tax path. Order 1002 stores total 963.90 / GST
45.90; invoice source calculates 1083.24 / GST 183.60. Order 1004 has a stored
150 discount cap; invoice ignores it. Order 1008 is the all-18%, no-coupon control.

### Risks and missing documentation

- package.json has a placeholder failing npm test command, no initial tests or README.
- Synchronous full-file persistence has no transaction/locking mechanism.
- A hardcoded admin key guards an export route; no general authentication middleware
  is present. Its value must not appear in evidence.
- Dates are compared as DD/MM/YYYY strings (Ticket 3); settlement arithmetic can
  concatenate strings (Ticket 3). Cancellation stock release is inconsistent
  with order item fields (Ticket 2). These remain out of scope.
- Quantity parsing and fallback, customer validation, historical coupon/rate
  changes and rounding policies need documentation.
- config comments mention an admin reset and HSN prefixes, but no reset route is
  implemented and tax.js performs exact HSN key lookup.

## I suspect

- The separate accountant implementation drifted from the checkout changes.
  Comments suggest this history but are not reliable commit-history proof.
- Delegating invoice arithmetic to pricing should eliminate present calculation
  drift; characterization/regression tests must establish that first.
- Concurrent writes could lose updates; no concurrency experiment was run.
- Dependency declarations are old; installed-version/security auditing is outside
  this checkpoint and no network audit was performed.

## Inspection evidence

Read package.json, config.js, server.js, all ten lib files, all four routers,
public/index.html, public/js/app.js and data/db.json. Listed repository files,
checked git status/current branch/latest commit and hashed data/db.json and
package-lock.json. No dependencies installed, no server started, no GitHub access,
no application files edited. Initial branch: main; initial commit: 68c85a9.
Pre-existing untracked files: workshop PDF and package-lock.json.

Read-only CP1 complete; no files changed during inspection.
This evidence document was saved afterward as explicitly requested.
