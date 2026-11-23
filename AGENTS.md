# ShopLedger

Node.js 22+, CommonJS, Express 4, and browser JavaScript.
Run the app with `npm start` and tests with `node --test`.

- `server.js` serves `public/`, mounts API routes, and renders invoices.
- `routes/` handles orders, products, customers, and reports.
- `lib/` handles pricing, GST, coupons, stock, invoices, Khata, and storage.
- `config.js` holds shop and business rules. `data/db.json` holds the data.

## Working rules

1. Read the relevant code and trace the normal entry point first.
2. Characterize existing behavior with tests before fixing it.
3. Keep the fix small and inside the selected ticket's production files.
4. Use in-memory fixtures. Tests must never touch `data/db.json`.
5. Run the tests and review the diff before opening a pull request.

## Ticket 1 · Invoice and GST mismatch

Change `lib/invoice.js` and its tests in `test/invoice.test.js`.
Keep the invoice and GST Audit API on the checkout pricing rules.
