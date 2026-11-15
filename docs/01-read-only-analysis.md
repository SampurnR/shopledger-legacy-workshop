# CP1: Read-only codebase analysis

Project folder: `shopledger-legacy-workshop`
Mode: **read-only**
Selected assignment: Ticket 2, inventory availability and cancellation restoration.

This records the source inspection completed before creating the checkpoint files,
tests, or temporary servers. During that analysis no files were changed, no
dependencies were installed, and no server was started. Dependency installation
was completed earlier as a separate setup step.

## I am sure

ShopLedger is a wholesale and retail POS with customer khata accounts, stock
tracking, coupons, printable GST invoices, and reconciliation reports. It uses
Node.js, Express, CommonJS modules, and a plain HTML/CSS/JavaScript frontend.
There is no frontend build step. `data/db.json` is the persisted database.

### Module map

| File or directory | Responsibility |
| --- | --- |
| `public/index.html`, `public/js/app.js`, `public/css/style.css` | POS, order history, khata, and inventory/GST audit UI |
| `server.js` | Static assets, JSON middleware, API routers, HTML invoice route |
| `routes/products.js` | Products and coupons |
| `routes/orders.js` | Order list, detail, checkout, cancellation |
| `routes/customers.js` | Customer accounts and settlements |
| `routes/reports.js` | Dashboard, reconciliation, pricing preview, admin export |
| `lib/inventory.js` | Sellable stock, checks, stock mutations, inventory summary |
| `lib/orders.js` | Order records, cancellation, search, date filtering and sorting |
| `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js` | Checkout discount and HSN GST calculations |
| `lib/ledger.js` | Khata credit limits, charges, reversals, settlements |
| `lib/invoice.js`, `lib/reports.js` | Printed invoice calculation and reporting |
| `lib/dates.js` | Date formatting and normalization |
| `lib/store.js` | Synchronous JSON reads/writes and audit log |
| `config.js` | Shop identity, tax slabs, coupons, stock settings, export key |

### Placing an order

1. The UI posts selected IDs and quantities to `POST /api/orders`.
2. The router loads the database and resolves trusted product prices and HSN codes.
3. Inventory checks sellable stock: physical units minus wholesale reserved holds.
4. Coupons are normalized and validated. Pricing allocates discounts and applies GST.
5. Khata orders require a registered customer and must pass the credit-limit check.
6. Inventory deducts physical units, orders creates the record, and store appends an
   audit entry and writes the JSON file. The API returns HTTP 201.
7. The browser refreshes stock, customer balances, and dashboard figures.

### Confirmed risks

- Ticket 2: the stock check uses `>=`, rejecting an exact sellable quantity.
- Ticket 2: cancellation passes order lines with `id`, but release looks for
  `productId` and changes `reserved` instead of reversing the physical deduction.
- Checkout and invoice calculations are separate and apply different rules.
- Date filters and sorting compare day-first strings.
- Settlement totals add a raw request value, allowing string concatenation.
- Business APIs lack authentication; export uses a hardcoded query key.
- Browser HTML construction includes unescaped stored values.
- Persistence rewrites the entire JSON file synchronously without atomic replacement.
- At the source baseline there is no README or implemented test suite. Dependency
  versions have caret ranges, and the workshop excludes the generated lockfile.

## I suspect

- The cancellation release helper was reused from wholesale quote handling: its
  comments and reserved-stock mutation suggest that history, but intent is unconfirmed.
- Multiple server processes sharing one data file could lose updates. This is a
  design risk, not a concurrency incident reproduced in CP1.
- Changing tax/coupon configuration could alter historical invoice recalculations.
  An explicit historical-tax policy has not been supplied.

These observations are separate from Ticket 2's implementation scope.
