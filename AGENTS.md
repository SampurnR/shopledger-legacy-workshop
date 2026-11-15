# ShopLedger contributor guide

## Scope and architecture

ShopLedger 0.8.4 is a Node.js/CommonJS Express monolith for retail and
wholesale billing, stock tracking, and customer Khata (credit accounts).

- `server.js`: Express setup, JSON parsing, static assets, `/api` routers,
  and printable HTML invoices at `/orders/:id/invoice`. Exports the app;
  starts listening only when run directly.
- `routes/products.js`: product catalog and active coupons.
- `routes/orders.js`: order listing, details, creation, and cancellation.
- `routes/customers.js`: customer balances and settlement recording.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and
  key-protected database export.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`: checkout calculations.
- `lib/orders.js`, `lib/inventory.js`, `lib/ledger.js`: business operations
  that mutate the supplied database object in memory.
- `lib/invoice.js`: separate invoice calculation and HTML rendering.
- `lib/reports.js`, `lib/dates.js`: reporting and date helpers.
- `lib/store.js`: synchronous whole-file JSON persistence and audit entries.
- `config.js`: shop details, tax mapping, coupons, inventory defaults, port,
  and a legacy hardcoded admin key.
- `public/`: plain HTML/CSS/JavaScript interface using XMLHttpRequest;
  tabs cover POS, orders, Khata, and inventory/GST reconciliation.
- `data/db.json`: products, orders, customers, settlements, audit log,
  `nextOrderId`, and `nextSettlementId`. There is no database server or ORM.

The PDF route is unfinished. Product/customer maintenance, restocking,
dispatch completion, and admin reset endpoints are not implemented.

## Setup and commands

Run from the repository root:

```sh
npm ci
npm start
# Optional port override:
PORT=3001 npm start
```

Use `npm ci` when a compatible lockfile is available. Otherwise use
`npm install`; it may create or change `package-lock.json`, so inspect its
diff and keep dependency changes intentional. No Node version is declared
in the repository; record the runtime used when investigating compatibility.
The default URL is `http://localhost:3000`.

`npm test` currently prints "Error: no test specified" and exits with status
1. There are no configured lint, build, or automated test commands. Do not
report this placeholder as a passing test suite.

## Coding conventions

- Follow the surrounding style: CommonJS `require`/`module.exports`, `var`,
  ordinary functions, two-space indentation, single quotes, and semicolons.
  Avoid unrelated formatting or framework migrations.
- Keep HTTP parsing/status handling in routes and reusable business rules
  in `lib/`. Helpers generally return `{ ok, error }` or validation results;
  route handlers persist successful mutations through `store.write`.
- Resolve prices and product metadata on the server. Validate request shapes,
  finite numeric values, quantities, IDs, statuses, and payment modes at the
  boundary; do not silently trust browser validation.
- Preserve existing API contracts unless a change explicitly requires an
  update. Inspect browser callers alongside backend changes.
- Amounts are rupees represented by JavaScript numbers, with two-decimal
  rounding helpers. Check rounding explicitly; avoid implicit string coercion.
- Stored business dates currently use `DD/MM/YYYY`; audit timestamps use ISO
  strings. Parse dates chronologically rather than comparing display strings.
- Prefer `textContent` for dynamic browser text. Escape untrusted content
  when HTML rendering is necessary; existing `innerHTML` use is not a safe
  example to copy.

## Business rules and known defects

These rules describe checkout behavior and required consistency. Known defects
below are investigation targets, not behavior to preserve in new code. Do not
silently repair historical records as part of an unrelated change.

### GST, coupons, and invoices

- Checkout subtotal is the sum of server-resolved unit price times quantity.
- Normalize coupon codes by trimming and uppercasing. Enforce active status,
  minimum subtotal, percentage/flat calculation, discount caps, and a discount
  no greater than subtotal through `lib/coupons.js`.
- Checkout allocates the cart discount proportionally across lines, rounds
  each allocation, and calculates GST on post-discount taxable line amounts.
  Check allocation rounding when modifying this logic.
- `lib/tax.js` uses a numeric `gstRate` override, then an exact HSN lookup in
  `config.tax.hsnSlabs`, then the 18% fallback. Although configuration comments
  describe prefixes, the implementation uses exact keys. Explicit numeric
  rates greater than one are percentages; rates at or below one are decimals.
- The configured slabs include 5%, 12%, and 18%. These are application settings,
  not a guarantee of current statutory rates. Verify requirements before
  changing tax policy. Current splitting assumes intra-state Maharashtra
  supply and divides GST into CGST and SGST; interstate IGST is not implemented.
- Invoice and stored order figures should agree. Currently `invoice.js`
  recalculates independently, usually applies 18%, taxes before discount, and
  ignores coupon caps/eligibility. It also interprets explicit rates differently.
  Current configuration can therefore change historical invoice output.
- The supplied dataset has 7 mismatches among 8 orders, with an absolute total
  variance of Rs 612.01. Treat this as a baseline finding, not an expected
  permanent test result. Reconciliation detects differences; it does not fix them.

### Inventory and orders

- Sellable quantity is `max(0, stock - reserved)`. Reserved units represent
  wholesale holds. `inventory.reserve()` actually deducts physical `stock`;
  it does not increase `reserved`.
- Aggregate repeated product IDs before availability checks. A committed order
  must not consume more sellable stock than available. Check the exact-stock
  boundary explicitly: current code rejects `qty >= sellable` and independently
  validates duplicate lines, allowing combined quantities to oversell.
- Both pending and completed orders currently deduct stock immediately and
  charge Khata when selected. Dashboard revenue includes pending orders.
  Treat changes to that timing as business behavior changes.
- Cancellation must reverse the original physical stock deduction exactly once
  and reverse any Khata debit. Current cancellation blocks repeated cancellation,
  but inventory release looks for `productId` instead of order-line `id` and
  decreases reservations instead of restoring physical stock.
- The `allowBackorder` setting is unused. Do not assume it enables backorders.
- Creation currently coerces invalid/nonpositive quantities to one; preview
  permits positive numeric quantities. Align validation deliberately when fixing.
- Cash/UPI labels record a mode; they do not verify payment or trigger refunds.

### Customer Khata

- Balance is `openingBalance + totalBilled - totalSettled`. Customer listing
  recomputes it; mutation helpers also maintain a cached `balance` field.
- Khata orders require an existing customer account. Adding an order debit
  must respect the customer's credit limit. Current truthy limit checks and
  display defaults handle zero inconsistently; define zero-limit semantics
  explicitly before changing them.
- Cancellation reverses the order's Khata debit. Keep balances, billed totals,
  order status, and inventory consistent across the operation.
- Settlement amounts must be finite positive numbers before updating totals.
  The browser currently submits a string and `recordSettlement()` adds it
  directly: `1200 + '500'` becomes `'1200500'`. Converting only the receipt
  amount afterward does not protect the customer total.
- Settlements have separate receipts, but are not allocated to invoices. No
  overpayment policy, settlement reversal, or complete immutable ledger exists.
  Do not infer those policies or reconstruct balances from orders alone.

## Testing expectations

- For business-logic fixes, add focused regression coverage for the affected
  rule. Use cloned fixtures and pure/in-memory helpers wherever possible.
- Cover mixed GST slabs, explicit/fallback rates, coupon minimums and caps,
  rounding, and agreement between preview, saved order, and invoice figures.
- Cover exact stock, reserved stock, duplicate product lines, insufficient
  stock, cancellation restoration, and repeated cancellation.
- Cover numeric and string settlement input, invalid/non-finite amounts,
  credit-limit boundaries, debit reversal, and balance consistency.
- Cover chronological filtering/sorting across month and year boundaries.
- API checks should verify status codes, error responses, and that rejected
  operations leave data unchanged. Use isolated storage for mutation tests.
- For UI changes, check the affected tab and request flow, including safe
  rendering. For invoice changes, inspect printable output as well as numbers.
- Report exactly what was checked and any unavailable coverage. Do not add
  unrelated tests for documentation-only edits.

## Protecting data and keeping changes scoped

- Treat `data/db.json` as sensitive operational data containing customer contact
  details, credit balances, orders, and payment history. Never use it as a
  writable test fixture or commit incidental business-data changes.
- `store.js` has a fixed database path: starting on a different port does not
  isolate storage. Before mutation testing, use an explicitly isolated copy
  of the application/data or introduce an authorized test-storage mechanism.
- Never exercise order creation, cancellation, or settlement against the
  repository database during a read-only analysis. Pure helpers can also mutate
  their arguments, so deep-clone fixtures before calling them.
- Before authorized data migrations or repairs, preserve a recoverable backup
  in an approved location, validate the result, and provide a rollback plan.
  Do not reset data, renumber IDs, or rewrite historical totals without scope.
- Whole-file writes are synchronous and non-atomic. There is no locking,
  transaction, or automatic recovery. Concurrent processes can lose updates;
  interrupted writes can corrupt the file. Avoid multiple writers.
- Most routes have no authentication. Export uses a hardcoded query-string
  key. Do not expose the service publicly or copy secrets/customer data into
  logs, reports, or examples. Access-control fixes require explicit coverage.
- Audit history is capped at 100 entries and has no operator identity; do not
  treat it as a complete accounting trail or backup.
- Check `git status` before and after work. Preserve existing user changes,
  including untracked files. Do not stage, overwrite, or remove unrelated files.
