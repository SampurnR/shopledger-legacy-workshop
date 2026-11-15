# ShopLedger operating manual

## Project summary
- ShopLedger handles retail/wholesale GST billing, inventory, and customer khata for an Indian shop.
- The browser UI calls Express routes; orders, stock, accounts, settlements, and audit entries persist in one JSON file.

## Stack
- Node.js, CommonJS JavaScript, Express `^4.17.1`, body-parser `^1.19.0` (`package.json`).
- Static HTML/CSS and vanilla JavaScript with XMLHttpRequest; no frontend build step (`public/`, `server.js`).
- Synchronous JSON-file persistence in `data/db.json`; no database server (`lib/store.js`).

## How the app works
- Startup: `server.js` loads config, parses JSON request bodies, serves `public/`, and mounts the four routers under `/api`.
- Browser boot: `public/js/app.js` loads products, customers, dashboard totals, and GST reconciliation. Tab handlers load order history or refresh customer/audit views.
- Build a bill: the UI keeps quantities in memory and posts selected items/coupon to `/api/pricing/preview`; `routes/reports.js` resolves database prices and HSN codes before calling pricing/coupon logic.
- Place an order: POST `/api/orders` resolves products, checks stock/coupon, calculates totals, optionally charges the customer's Khata, deducts stock, appends an order and audit entry, then writes the database (`routes/orders.js`).
- After HTTP 201, the UI clears its cart, refreshes products, preview, dashboard, and customers, and offers an invoice link (`public/js/app.js` place handler).
- Order history can request cancellation; the server marks the order cancelled, invokes inventory release, reverses an applicable Khata debit, audits, and saves. See Known Quirks before assuming stock is restored (`lib/orders.js:cancel`, `routes/orders.js`).
- Customer settlements update account totals and prepend a settlement entry, then audit and save; reports aggregate the current database (`routes/customers.js`, `lib/ledger.js`, `lib/reports.js`).
- Persistence: handlers read a JSON snapshot through `lib/store.js`; mutations affect that snapshot until `store.write(db)` synchronously replaces file contents. There is no separate database service.
- Invoices: GET `/orders/:id/invoice` reads the stored order and returns printable HTML. `lib/invoice.js` recalculates figures independently; reconciliation compares those figures with stored order totals (`server.js`, `lib/reports.js:getGstReconciliation`).

## Commands
- `npm install`: install declared dependencies; review any lockfile changes separately from ticket work.
- `npm start` / `node server.js`: listen on `PORT` or 3000; startup logs `ShopLedger listening on http://localhost:<port>` (`server.js`).
- `npm test`: currently prints `Error: no test specified` and exits 1 (`package.json:scripts.test`). There is no test suite in this checkout.
- For a testing-infrastructure ticket, use built-in `node:test` and `node:assert/strict`, check `node -v` is 18+, and set `scripts.test` to `node --test`.
- After creating tests, run a single file with `node --test test/pricing.test.js`; require zero failures and exit 0. That file does not exist yet.
- Do not claim commands passed without running them. Do not run HTTP smoke tests against the real database; use a temporary application copy with a hand-built `data/db.json`.

## Module map + dependency graph
- Flags: **P** = no input mutation, I/O, or clock; **C** = reads shared config (directly or transitively), so not strictly pure; **M** = mutates caller-owned objects; **T** = reads the clock; **IO** = filesystem access.
- All `lib/` modules except `store.js` are safe to test directly with fresh fixtures; **C** tests must restore config changes, **M** tests must not share fixtures, and **T** tests must freeze time.
- No other `lib/` module calls `store.js`, directly or indirectly. All four routers and the invoice handler in `server.js` call it and require store isolation in tests.
- `config.js` **C**: reads `process.env.PORT` on load; exports port, adminKey, shop, tax, inventory, coupons; no imports.
- `lib/pricing.js` **C** → tax, coupons: `round2(n)`, `subtotal(items)`, `discount(subtotal, code)`, `computeTotals(items, code)`.
- `lib/tax.js` **C** → config: `round2(n)`, `getRateForItem(item)`, `getSlabPercent(item)`, `splitCgstSgst(taxAmount)`.
- `lib/coupons.js` **C** → config: `normalizeCode(code)`, `getCoupon(code)`, `validate(code, subtotal)`, `calculateDiscount(subtotal, code)`, `listActive()`.
- `lib/invoice.js` **C** → config: `computeInvoiceFigures(order)`, `render(order)`; returns figures or HTML, does not persist anything.
- `lib/inventory.js` **C/M** → config: `find(products, id)`, `getSellableStock(product)`, `check(products, items)`, `reserve(products, items)`, `release(products, items)`, `summarize(products)`.
- `lib/ledger.js` **M/T** → dates: `findCustomer(db, id)`, `listCustomers(db)`, `chargeOrderToKhata(db, customerId, orderTotal)`, `reverseOrderDebit(db, customerId, orderTotal)`, `recordSettlement(db, customerId, amount, mode, note)`.
- `lib/orders.js` **C/M/T** → dates, inventory, ledger: `add(db, orderData)`, `get(db, id)`, `cancel(db, id, reason)`, `list(db, filters)`.
- `lib/dates.js` **P/T** → no imports: `today()` reads local time; `normalizeDateKey(str)` and `getFiscalYear(dateStr)` are pure.
- `lib/reports.js` **C** → inventory, ledger, invoice: `getDashboardSummary(db)`, `getGstReconciliation(db)`; reads fixtures without persisting or calling clock-reading functions.
- `lib/store.js` **IO/M/T** → Node fs, path: `read()`, `write(db)`, `appendAudit(db, action, details)`; isolate before calling any export in a test.
- `routes/products.js` → Express, store, inventory, tax, coupons: GET `/api/products`, `/api/coupons`.
- `routes/orders.js` → Express, store, inventory, pricing, coupons, orders, ledger: GET `/api/orders`, `/api/orders/:id`; POST `/api/orders`, `/api/orders/:id/cancel`.
- `routes/customers.js` → Express, store, ledger: GET `/api/customers`; POST `/api/customers/:id/settle`.
- `routes/reports.js` → Express, config, store, reports, pricing, coupons: GET `/api/reports/dashboard`, `/api/reports/gst-reconciliation`, `/api/admin/export`; POST `/api/pricing/preview`.
- `server.js` → Express, body-parser, Node path, config, store, orders, invoice, all four routers; serves `public/`, mounts `/api`, and renders GET `/orders/:id/invoice`.
- UI: `public/index.html`, `public/css/style.css`, `public/js/app.js`; app.js holds cart state, requests previews, places/cancels orders, records settlements, and renders reports.
- `data/db.json` shape: products/orders/customers/settlements/auditLog arrays and nextOrderId/nextSettlementId counters. Use hand-built equivalents for tests.

## Domain invariants (implemented behaviour)
- Money is rupees in JavaScript Numbers, including fractional rupees, not integer paise (`lib/pricing.js:computeTotals`, `public/js/app.js:fmtMoney`).
- `round2(n)` is `Math.round((Number(n) + 1e-9) * 100) / 100`; pricing and tax export it; coupons, invoice, ledger, reports have private copies. Inventory valuation instead uses `Math.round(totalValuation * 100) / 100` (`lib/inventory.js:summarize`).
- Pricing: round sum of price×qty → calculate coupon discount → round each line gross, proportional discount, taxable amount, and tax → accumulate rounded line taxes → total = rounded(subtotal − discount + tax) (`lib/pricing.js:subtotal,computeTotals`).
- GST exact HSN keys: 5% = 1006/0713/1104/1512/1508/1701; 12% = 0405/0904; 18% = 0902/0901/2106; fallback 18% (`config.js:tax`, `lib/tax.js:getRateForItem`).
- Numeric gstRate overrides HSN: values >1 divide by 100; values ≤1 are fractions. CGST = round2(tax/2), SGST = round2(tax−CGST); no IGST calculation or interstate selection (`lib/tax.js:getRateForItem,splitCgstSgst`).
- Coupons normalize trim/uppercase; one code, no stacking; blank is valid. Only `active === false` means expired; no calendar expiry. Minimum subtotal is inclusive; percent caps apply when truthy, flat discount ignores maxDiscount; discount cannot exceed positive subtotal (`lib/coupons.js:validate,calculateDiscount`).
- Configured coupons: SAVE10 10%, min ₹500, cap ₹150; FLAT50 ₹50, min ₹300; WELCOME 5%, cap ₹100; WHOLESALE15 15%, min ₹2000, cap ₹400; DIWALI20 inactive (`config.js:coupons`).
- Creation sequence: read → resolve products and parseInt quantities (invalid/<1 becomes 1) → stock check → coupon validation/totals → optional Khata charge → stock deduction → order append/ID allocation → audit → write → HTTP 201 (`routes/orders.js:POST /orders`).
- UI offers pending/completed; creation accepts arbitrary truthy status and defaults to completed. Lifecycle: `new → supplied status or completed; any existing non-cancelled status → cancelled; cancelled → reject repeat cancellation`. No completion/update transition endpoint exists (`lib/orders.js:add,cancel`, `routes/orders.js`).
- Sellable = max(0, stock−reserved); check rejects qty ≥ sellable. `reserve` deducts physical stock; `release` only reduces reserved using item.productId, without adding stock (`lib/inventory.js:getSellableStock,check,reserve,release`).
- Khata balance = round2(openingBalance + totalBilled − totalSettled). Charge rejects projected balance above a truthy creditLimit, then increases totalBilled; cancellation reverses debit with totalBilled floored at zero (`lib/ledger.js:listCustomers,chargeOrderToKhata,reverseOrderDebit`).
- Settlement rejects missing customer and falsy/nonpositive amount; adds raw amount to totalSettled, stores Number(amount) in a new prepended entry, and allows overpayment (`lib/ledger.js:recordSettlement`).
- Dates: today uses host-local Date getters, DD/MM/YYYY; no explicit India timezone. Normalization reverses YYYY-MM-DD into DD/MM/YYYY without validation; fiscal year starts April, malformed non-three-part input falls back to FY21-22 (`lib/dates.js`).
- Store read/write hardcode the repository data path; no environment override. Missing falsy collections/counters are defaulted; audit timestamps use UTC ISO and retain 100 entries (`lib/store.js:read,write,appendAudit`).

## Known Quirks / suspected bugs
- Do not 'fix' these unless the ticket asks; characterization tests must pin them on purpose. There are currently no test files to link; add coverage before changing affected behaviour.
- Float money and independent rounding can make line sums differ from cart totals; rounding is asymmetric for negative halves (`lib/pricing.js:round2,computeTotals`).
- Invoice ignores HSN; uses truthy gstRate/100 or default 18%; computes tax before discount and percentage discount on subtotal+tax. It bypasses active/minimum/caps/normalization and can produce negative totals for flat coupons (`lib/invoice.js:computeInvoiceFigures`).
- Invoice rounds aggregate tax separately from row tax; do not replace its calculations with pricing as an unrelated cleanup (`lib/invoice.js:computeInvoiceFigures`).
- HSN lookup is exact despite the config's prefix comment; numeric GST overrides have no range validation (`lib/tax.js:getRateForItem`).
- Stock check rejects purchasing exactly the sellable quantity and does not aggregate duplicate item IDs. Cancelled order lines have id, while release expects productId; physical stock is never restored (`lib/inventory.js:check,release`, `lib/orders.js:cancel`).
- UI settlement amount is a string; raw addition concatenates totalSettled. Nonnumeric truthy strings can pass validation; overpayment yields negative balances (`public/js/app.js` settlement handler, `lib/ledger.js:recordSettlement`).
- Day-first strings are compared lexically for order ranges/sorting; the sort comparator returns −1 even for equal dates. Local business dates and UTC audit dates can disagree near midnight (`lib/orders.js:list`, `lib/dates.js:today`, `lib/store.js:appendAudit`).
- Pricing helpers accept zero/negative quantities; order POST coerces them to 1, while preview skips nonpositive quantities. Status/payment modes lack allowlists (`lib/pricing.js:computeTotals`, `routes/orders.js`, `routes/reports.js`).
- Whole-file writes have no atomic replacement, locks, or transactions; multiple processes or stale snapshots can overwrite updates. Sync handlers do not imply concurrent asynchronous writes inside one handler (`lib/store.js:read,write`).
- Admin export checks a configured static key in the query; config mentions reset, but no reset endpoint exists. PDF route is only a comment (`routes/reports.js`, `server.js`).

## Workflow for every ticket
1. Read the ticket, identify its target module, and inspect callers/dependencies above.
2. Run `npm test`; currently expect the documented placeholder failure. Report that baseline; do not call it green or expand a behaviour ticket into infrastructure work without authorization.
3. Where tests exist, extend characterization coverage for current target behaviour first; if absent, agree on built-in test setup before implementation.
4. Change the target module only; preserve unrelated quirks and formatting.
5. Update only assertions intentionally changed by the ticket; explain each changed expectation in the commit/PR.
6. Run relevant tests and the available suite; compare database SHA-256 and mtime before/after. Only a read-only integrity check may inspect the real database.
7. Summarize changed behaviour, preserved behaviour, changed assertions, and any verification gaps.

## Rules
- Characterization tests first; never silently turn a suspected bug into a new business rule.
- Limit production edits to the ticket's module. Related tests are allowed; changing package.json's test script requires test-setup scope.
- Never modify `data/db.json` or use its contents as fixtures; isolate persistence before exercising routes/store. Read-only hash/mtime checks are allowed solely to prove integrity.
- No new dependencies; use Node built-ins for test tooling.
- No unrelated reformatting; retain CommonJS.
- Keep synchronous filesystem semantics unless the ticket explicitly changes persistence.
- Do not compare unrounded float money with `===`; use the applicable existing rounding helper and explicit rounded expectations. Do not introduce a currency-unit migration incidentally.

## Testing conventions
- Future tests: `test/<module>.test.js`, built-in `node:test` and `node:assert/strict`; deterministic fixture factories in `test/helpers/fixtures.js` (not present yet).
- Future store helper: `test/helpers/isolate-store.js` (not present yet); use os.tmpdir()+fs.mkdtempSync or in-memory data and patch the shared store exports before any caller runs; restore exports and clean temp files with t.after.
- Patching exports affects the process: never run tests sharing that patched store concurrently. Direct ledger/inventory tests need fresh objects, not persistence isolation, unless testing a store-using caller.
- Freeze Date with supported node:test mock timers for today()/audit tests, or stub dates.today for callers; restore after each test. Set an explicit timezone when asserting local dates.
- Restore temporary config coupon changes after tests; do not modify config.js to add test coupons.
- Cover empty carts, zero/negative quantities, 100% fixture discount, inactive coupons/minimum/caps, all GST slabs, half-paise rounding, overpayment, cancellation, and cross-month/year dates.
- Mark odd assertions: `// CHARACTERIZATION: current behaviour, possibly a bug — see AGENTS.md Known Quirks`.
- Add a before/after SHA-256 and mtime integrity guard when setting up the suite; no such guard currently exists.

## Definition of done
- [ ] Only authorized files changed; no new dependencies or incidental fixes.
- [ ] Current behaviour characterized; intentional expectation changes explained.
- [ ] Available checks run and results reported honestly, including absent test infrastructure.
- [ ] Real database bytes and mtime unchanged; temporary persistence/config/clock patches cleaned up.

## When unsure
- Stop and ask about ambiguous money, GST, inventory, or ledger requirements; cite the actual function and observed behaviour rather than guessing the intended rule.
