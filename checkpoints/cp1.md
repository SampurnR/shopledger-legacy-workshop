# ShopLedger code review

## I am sure

### What the app does

ShopLedger is a small shop billing and record-keeping app. Staff can select products, make an order, record payment as cash, UPI, or customer credit (“Khata”), and see order history, customer balances, stock, and GST reconciliation. It stores its records in a local JSON file rather than a database. The UI describes the shop and GST details in [public/index.html](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/index.html:6), and the server serves that UI and the API in [server.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/server.js:15).

Some domain terms used in the code:

- **Khata** is a customer credit account. An order charged to Khata increases the customer’s billed amount, subject to a credit limit; settlements record payments against the balance. See [ledger.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/ledger.js:34).
- **GST** is the tax calculated on the order. The code splits it into CGST and SGST, described as an equal split for an intra-state Maharashtra sale in [tax.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/tax.js:28).
- **HSN** is the product classification code used here to select a GST rate. The configured prefixes map to 5%, 12%, or 18%; unmatched codes use an 18% default in [config.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/config.js:16) and [tax.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/tax.js:9).
- **Physical stock** is the product’s `stock` count. **Reserved stock** is deducted from physical stock to calculate **sellable stock**: `max(0, stock - reserved)`. This is presented as stock held for wholesale quotes in [inventory.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/inventory.js:12). When an order is placed, however, the code reduces physical stock directly.
- **Order ledger** means the order record’s stored subtotal, discount, tax, and total. The invoice code independently recalculates figures and the reports compare those calculations in [reports.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/reports.js:59).

### Repo module map

| File or folder | Responsibility and dependencies |
|---|---|
| `server.js` | Express setup, JSON request parsing, static `public/` hosting, API route mounting, and printable invoice route. Connects route modules and `lib/` helpers. See [server.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/server.js:1). |
| `config.js` | Port, shop details, tax rates, inventory defaults, and coupon definitions. Used by tax, coupon, invoice, and server code. See [config.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/config.js:1). |
| `package.json`, `package-lock.json` | App metadata and dependency declarations/lockfile. `package.json` declares Express and body-parser. |
| `routes/` | HTTP endpoints. `orders.js` calls store, inventory, pricing, coupons, orders, and ledger; `products.js` calls store, inventory, tax, and coupons; `customers.js` calls store and ledger; `reports.js` calls store, reports, pricing, coupons, and config. |
| `lib/store.js` | Reads/writes `data/db.json`, supplies missing top-level collections, and prepends audit entries. Used by the routes and invoice endpoint. See [store.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/store.js:4). |
| `lib/inventory.js` | Finds products, calculates sellable stock, checks quantities, adjusts stock, and summarizes inventory. Uses inventory defaults from config. |
| `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js` | Calculate subtotal, coupon discounts, GST by HSN, and totals. Pricing depends on coupons and tax; coupons and tax depend on config. |
| `lib/orders.js` | Adds, finds, lists, and cancels orders. Uses dates, inventory, and ledger. |
| `lib/ledger.js` | Lists customer balances, charges and reverses Khata orders, and records settlements. Uses date helpers. |
| `lib/dates.js` | Produces `DD/MM/YYYY` dates and normalizes date-filter input. Used by orders and ledger. |
| `lib/invoice.js` | Recalculates invoice figures and renders printable HTML. Uses config. The server exposes it at `/orders/:id/invoice`; reports also call its calculator. |
| `lib/reports.js` | Builds dashboard totals and compares stored order totals with invoice calculations. Uses inventory, ledger, and invoice. |
| `data/db.json` | The current products, customers, orders, settlements, next IDs, and audit log. Read and written by `lib/store.js`. |
| `public/index.html`, `public/js/app.js`, `public/css/style.css` | The single-page interface, browser-side API calls and rendering, and its styling. `server.js` serves these static files. |
| `docs/architecture.svg` | An architecture diagram. |

### Order placement, step by step

1. The user selects products and quantities in the catalog. The browser code keeps quantities in `cartQuantities`; `getSelectedCartItems()` creates the cart data. The UI and order controls are in [index.html](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/index.html:72), and the cart functions are in [app.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/js/app.js:130) and [app.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/js/app.js:146).

2. `updateCartPreview()` sends the cart and coupon to `POST /api/pricing/preview`. The route resolves product IDs and computes preview totals with `pricing.subtotal()`, `coupons.validate()`, and `pricing.computeTotals()`. See [app.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/js/app.js:163) and [routes/reports.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/reports.js:24).

3. Clicking “Place Order” sends the selected items, customer, payment mode, status, and coupon to `POST /api/orders`. See [app.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/js/app.js:501).

4. The order route reads the JSON store, rejects an empty cart or unknown product, and rebuilds each line from the product record. It takes the product’s stored ID, SKU, name, HSN, and price; it parses quantity as an integer. See [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:29).

5. `inventory.check()` checks requested quantities against sellable stock. If the check passes, `pricing.subtotal()` and the coupon helpers validate the code and compute the discount. `pricing.computeTotals()` allocates the discount proportionally across lines, calculates GST on each line’s discounted taxable value using its HSN rate, and returns the tax and total. See [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:57), [pricing.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/pricing.js:25), and [tax.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/tax.js:10).

6. If payment mode is `khata`, the route requires a customer ID and calls `ledger.chargeOrderToKhata()` with the order total. That checks the customer’s projected balance against their credit limit and updates the billed amount. See [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:83) and [ledger.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/ledger.js:35).

7. The route calls `inventory.reserve()` to subtract the ordered quantities from physical stock. It then calls `orders.add()` to assign an ID and date and append an order record containing the customer, payment mode, status, items, coupon, subtotal, discount, tax, and total. See [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:93) and [orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/orders.js:5).

8. The route appends an `ORDER_CREATED` audit entry and calls `store.write()` to serialize the updated object to `data/db.json`, then returns the order to the browser. The UI clears the cart and reloads products, dashboard totals, and customers. See [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:108), [store.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/store.js:23), and [app.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/public/js/app.js:520).

9. The invoice link opens the server’s invoice route. It calls `invoice.render()`, which calls `computeInvoiceFigures()` and calculates the displayed GST and total from the saved line items and coupon. See [server.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/server.js:24) and [invoice.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/invoice.js:15).

### Risks and maintenance concerns visible in the code

- **Order cancellation appears not to restore stock.** Orders store item IDs as `id` in [orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/orders.js:13). Cancellation calls `inventory.release()`, which looks up `items[i].productId` and reduces `reserved`; the stored order items do not show that property, and order placement reduced `stock` directly. See [orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/orders.js:44) and [inventory.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/inventory.js:49).
- **The stock check rejects ordering the full remaining sellable quantity.** It fails when `qty >= sellable`, rather than only when the requested quantity exceeds availability. A request for exactly the sellable amount is rejected in [inventory.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/inventory.js:27).
- **Invoice and order totals use different tax and coupon calculations.** Order pricing resolves GST from HSN, applies the coupon against subtotal, and taxes the discounted line values in [pricing.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/pricing.js:25). Invoice calculation uses `gstRate` if present, otherwise the default 18%, and calculates coupon percentage against `subtotal + tax` without applying the configured maximum discount. Saved order lines from the route contain HSN but no `gstRate`. See [invoice.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/invoice.js:20) and [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:46). Reconciliation detects differences, but does not make the two calculations consistent.
- **Date filtering and sorting are fragile.** Dates are stored as `DD/MM/YYYY`; normalization changes HTML date input into the same format, but the code compares those strings lexicographically. That does not sort or filter dates chronologically across months and years. See [dates.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/dates.js:14) and [orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/orders.js:76).
- **Validation is limited.** Quantities that are invalid or below one are silently changed to one in [routes/orders.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/orders.js:43). The settlement route passes the request amount directly to the ledger, where checks use JavaScript comparisons and arithmetic without first requiring a finite numeric value. See [routes/customers.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/customers.js:19) and [ledger.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/ledger.js:62).
- **JSON persistence is synchronous and has no visible write coordination.** Each request reads and writes the whole file synchronously; a write is a direct overwrite, with no atomic-write or concurrent-update mechanism shown. See [store.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/lib/store.js:17).
- **Dependencies are declared with version ranges.** `package.json` uses `^1.19.0` for body-parser and `^4.17.1` for Express, so the manifest does not pin exact versions. See [package.json](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/package.json:12).
- **The test script explicitly reports that no test is specified.** I found no test files in the listed repo files. See [package.json](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/package.json:6).
- **Some admin/config documentation appears stale.** `config.js` says the admin key is used by export and reset, but the visible route file only implements `/admin/export`. See [config.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/config.js:4) and [routes/reports.js](/home/dekukoi/Documents/repos/shopledger-legacy-workshop/routes/reports.js:61).

## I suspect

- **Simultaneous orders or settlements could overwrite each other.** Each request reads a snapshot and later writes the whole JSON file; two overlapping updates could lose one another. I’d confirm with concurrent requests against a disposable copy or replace the file store with a transactional store.
- **The code may have been carried forward from an older Node/Express setup.** The package versions and comments refer to changes from 2021, but this read-only inspection does not establish what versions are currently installed or whether they have known vulnerabilities. I’d check the lockfile’s resolved versions and compare them with current advisories.
- **The customer balance fields in `db.json` may not always agree with their component totals.** For example, the stored balance for Kalyani Foods is not the result of `openingBalance + totalBilled - totalSettled` using the visible values. The app recomputes balances for the customer list, so I’d compare all stored balances with that formula and determine whether any external process depends on the stored `balance` field.
