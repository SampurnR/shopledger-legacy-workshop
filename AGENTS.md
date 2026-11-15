# Repository Guidelines

## Project Structure

ShopLedger is a Node.js/Express billing and inventory app. `server.js` serves `public/` and mounts the Express routers in `routes/`. `public/index.html`, `public/js/app.js`, and `public/css/style.css` implement the browser POS, order register, Khata ledger, and audit screens. `lib/` contains order, pricing, coupon, tax, inventory, ledger, report, invoice, date, and JSON-store logic. `config.js` holds shop, tax, coupon, and inventory settings. `data/db.json` is the live JSON-backed dataset. `test/` contains characterization tests using Node's built-in test runner; `docs/architecture.svg` maps the application.

## Order Flow

The browser posts a cart to `POST /api/orders`. `routes/orders.js` resolves product details from the catalog, checks stock, validates coupons, computes totals, optionally charges a Khata account, deducts stock, creates the order, appends an audit record, and writes the JSON database. `lib/pricing.js` applies coupon discount before HSN-based GST. Invoices are rendered separately by `lib/invoice.js`; this calculation can disagree with stored order totals. Cancellation currently changes order status and attempts to release inventory and Khata credit; the inventory release does not restore the stock deducted when placing an order. Tests capture this current behavior so a later fix can change it deliberately.

## Commands

- `npm install` installs the dependencies in `package.json`.
- `npm start` runs the app at `http://localhost:3000` by default; set `PORT` to change the port.
- `npm test` runs the dependency-free characterization suite with Node's test runner (Node.js 18 or newer).

## Style & Tests

Follow nearby CommonJS JavaScript: two-space indentation, single quotes, semicolons, and the existing `var` style. Use lowercase filenames; name test files `*.test.js`. Keep tests isolated with in-memory data and avoid modifying `data/db.json`. Add or update tests when changing observed business behavior. The tests describe current behavior, including known defects; revise defect-characterization assertions when fixing the underlying issue.

## Changes & Security

Recent commits use short, lowercase descriptive summaries; no strict commit prefix is established. PRs should explain behavior and data/API impact, report verification, and include screenshots for UI changes. Do not commit secrets: `config.js` currently contains an admin key. Treat `data/db.json` as application data, and do not expose the app to untrusted networks without authentication and access controls.
