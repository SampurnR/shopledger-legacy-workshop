# Repository Guidelines

This guide describes the implementation observed in the repository and the
characterization tests that capture it. Observed behavior is not automatically a
business requirement: known defects are passing assertions, not approved behavior
or skipped tests. Fixed defects are covered by tests labeled `REGRESSION`.

## Current Architecture and Module Organization

ShopLedger is one Node.js/Express process with a plain JavaScript browser UI.
`server.js` exports the Express app and only starts listening when run directly.
It serves `public/`, parses JSON bodies, mounts four routers under `/api`, and
handles `GET /orders/:id/invoice` directly.

- `routes/products.js`: catalog and coupons; `orders.js`: checkout/history/cancellation; `customers.js`: Khata accounts/settlements; `reports.js`: dashboard/reconciliation/preview/export.
- `lib/`: pricing, tax, coupons, inventory, orders, ledger, invoices, reports, dates, and storage. Keep business rules here and HTTP orchestration in `routes/`.
- `public/index.html`, `public/js/app.js`, `public/css/style.css`: four tabs, in-memory cart, XMLHttpRequest calls, and styling.
- `config.js`: shop, tax, coupons, inventory, and admin settings. `lib/store.js` synchronously reads/rewrites `data/db.json`; there is no transactional database.
- `tests/`: characterization tests and synthetic fixtures. The evidence and test boundaries are documented below; `docs/architecture.png` is an optional visual reference.

The browser has POS, order history, customer Khata, and inventory/GST audit tabs.
Its cart lives in memory. It requests pricing previews, submits orders, and
reloads selected datasets after mutations. Payment modes are recorded labels;
there is no payment processor, user authentication, PDF implementation, or
pending-to-completed endpoint.

`data/db.json` holds products, customers, orders, settlements, audit entries, and
ID counters. Reads parse the entire file; writes synchronously replace its
contents. There is no atomic replacement or transaction rollback. Audit history
retains at most 100 entries and does not identify the operator.

## How an Order Works Today

1. The UI posts product IDs/quantities, customer, coupon, payment mode, and status
   to `/api/orders`. `routes/orders.js` reads the database and rejects an empty
   cart or unknown products.
2. The route resolves server-owned prices and HSN values. It uses `parseInt` for
   quantities; invalid/non-positive values become one, and fractions are truncated.
3. `inventory.check()` checks each line independently against physical stock minus
   reservations. It rejects quantities equal to the available amount.
4. `coupons.validate()` normalizes codes and checks eligibility.
   `pricing.computeTotals()` distributes discounts proportionally and applies
   configured HSN-based tax to discounted lines.
5. Registered customers supply their stored names. Khata billing checks the
   projected balance against the credit limit and increases billed totals.
   Balance is opening balance + billed − settled.
6. `inventory.reserve()` deducts physical stock without increasing reservations.
   `orders.add()` assigns an ID and date and records item/total snapshots.
7. The route appends `ORDER_CREATED`, writes the entire database, and returns 201
   JSON. The browser clears cart quantities and refreshes selected datasets.

These side effects also happen for pending orders. Status values are not validated.
Invoice GET recalculates figures separately through `lib/invoice.js` rather than
simply displaying stored totals.

## Commands and Development

- `npm install`: install dependencies; inspect lockfile changes.
- `npm start` / `PORT=3001 npm start`: start locally, default port 3000.
- `npm test`: run `node --test tests/*.test.js`.
- `node --test tests/order-routes.test.js`: run one test file.
- `node --check routes/orders.js`: syntax check only.

No build, watcher, formatter, lint command, or coverage threshold is configured. Tests use built-in `node:test` and `node:assert/strict`; no Node version is pinned.

## Characterization Tests and Executable Evidence

Tests capture observed behavior, including defects; passing does not establish
business correctness. Names distinguish `current behavior`/`CURRENT BEHAVIOUR`,
`known behavior`, `known defect`, and `REGRESSION`. All values below come from synthetic test inputs, not assertions
about changing shop data.

| Area | Observed result | Test file |
| --- | --- | --- |
| Mixed-rate pricing | Rice 640 + tea 280 with SAVE10: discount 92, tax 74.16, total 902.16 | `tests/pricing-invoice.test.js` |
| Coupon boundaries | SAVE10 starts at 500 and caps at 150; inactive/unknown codes fail validation | `tests/pricing-invoice.test.js` |
| Invoice divergence | Oil subtotal 2240 with SAVE10: checkout 2194.50; invoice 2378.88 | `tests/pricing-invoice.test.js` |
| Inactive coupon | Invoice applies DIWALI20 even though checkout validation rejects it | `tests/pricing-invoice.test.js` |
| Last available unit | Stock 2 minus reserved 1 cannot satisfy quantity 1 | `tests/inventory-ledger.test.js` |
| Duplicate lines | Two six-unit lines pass against ten units and leave stock −2 | `tests/inventory-ledger.test.js` |
| Settlement types | Settled total 100 plus numeric 50 or string "50" becomes 150; nonnumeric/nonfinite amounts are rejected | `tests/inventory-ledger.test.js`, `tests/order-routes.test.js`, `tests/khata-settlements.test.js`, `tests/ticket-regressions.test.js` |
| Cancellation | Khata debit reverses, but physical stock is not restored; repeated cancellation fails | `tests/inventory-ledger.test.js`, `tests/order-routes.test.js` |
| Dates | History sorts chronologically; inclusive ranges accept DD/MM/YYYY and YYYY-MM-DD across month/year boundaries | `tests/dates-reports.test.js`, `tests/order-history.test.js`, `tests/ticket-regressions.test.js` |
| Reporting | Pending Khata orders count toward revenue; cancelled orders are excluded | `tests/dates-reports.test.js` |
| Checkout integrity | Browser prices are ignored; rejected requests do not write; product GST override is dropped | `tests/order-routes.test.js` |
| Status handling | Creating an order with status cancelled still charges Khata and deducts stock | `tests/order-routes.test.js` |
| Preview | Unknown products are ignored; invalid coupons return undiscounted totals | `tests/order-routes.test.js` |

## Test Isolation and Change Policy

Tests use Node's built-in runner and assertions without additional dependencies.
Use fresh synthetic fixtures from `tests/helpers.js`; no test loads the shop's
database. The route harness substitutes store reads/writes with an in-memory
persisted copy and restores mocks after each test. It calls real route handlers
and business modules, but does not test HTTP transport, body parsing, static
serving, or the DOM. Verify affected tabs and request failures manually for UI changes.

Never test mutations against repository data. For a bug fix, replace the affected
characterization with a regression asserting the agreed behavior, rename its
defect label, update this guide, and retain boundary coverage. Do not silently
delete failing assertions or change fixture totals to hide a difference.
Changing dates, tax rules, or stock semantics can affect historical records;
describe compatibility and reconciliation needs explicitly.

Order comparisons now use chronological keys without changing stored/displayed
dates; same-day ties use descending order IDs. Settlement normalization prevents new string-concatenation errors; it does
not reconstruct or repair previously corrupted balances. Historical data requires
separate reconciliation.

## Coding and Review Conventions

Match existing two-space indentation, single quotes, semicolons, CommonJS, camelCase, lowercase module filenames, and predominantly `var`. History uses short lowercase descriptive commit subjects without a formal prefix. PRs should describe behavior changes, relevant issues, validation, and data/configuration implications; include screenshots for UI changes.

## Data Safety and Verified Limitations

Mutation endpoints rewrite `data/db.json`; use disposable data for manual checks.
Do not add real customer data or credentials. Source inspection confirms missing
authentication, hardcoded query-key export protection, unescaped browser
`innerHTML`, full-file synchronous persistence, and missing submission idempotency.
The suite does not prove exploitability or crash recovery.

## Open Questions

The intended final-unit buffer, revenue-recognition policy for pending orders,
actual deployment exposure, dependency vulnerabilities, and historical data impact
remain unresolved. Distinguish these questions from reproduced defects. Do not
infer a requirement, incident, or vulnerability solely from a passing
characterization test or an old source comment.
