# ShopLedger workshop

ShopLedger is a CommonJS Node.js and Express app with a static POS UI and synchronous JSON storage.

- server.js mounts the product, order, customer and report routers and serves printable invoices.
- routes/orders.js checks inventory, computes checkout totals, applies Khata credit and records orders.
- lib/pricing.js, lib/tax.js and lib/coupons.js calculate checkout figures. lib/invoice.js renders invoices. lib/reports.js compares invoices with ledger records.
- lib/inventory.js manages stock, lib/orders.js handles order records, lib/ledger.js handles customer balances, and lib/dates.js handles dates. lib/store.js reads and writes the database.

Use npm install for dependencies, npm start to run the app, and node --test with Node.js 22 to run tests. Use a disposable checkout for write-route testing.

Write characterization tests first. Limit production code changes to the ticket's module. Use in-memory fixtures and keep tests away from data/db.json. Add no dependencies.
