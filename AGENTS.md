# ShopLedger
CommonJS Node.js application using Express 4 and body-parser. The static POS lives in public/. server.js mounts the four routers in routes/ and serves printable invoices. lib/ contains checkout pricing, coupons, GST, inventory, orders, date helpers, Khata, invoices, reporting and JSON persistence. config.js holds the shop and pricing settings.

Install with `npm install`. Run with `npm start` (port 3000 by default). Run tests with `node --test`. The npm test script is a placeholder.

- Write characterization tests before changing behavior.
- Limit production changes to the module or modules required by the selected ticket.
- Use in-memory fixtures for tests. Never read or write data/db.json in tests.
- Add no dependencies. Reproduce live issues on a temporary copy.
