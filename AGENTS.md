# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is an Express app for billing, inventory, and Khata credit. `server.js` serves the browser UI from `public/`, mounts the products, orders, customers, and reports routers under `/api`, and handles printable invoices at `/orders/:id/invoice`.

- `public/index.html`, `public/js/app.js`, and `public/css/style.css` contain the UI, browser behavior, and styles.
- `routes/` handles HTTP requests and responses. `lib/` contains business logic for orders, pricing, GST, coupons, inventory, Khata, invoices, and reports.
- `config.js` holds shop settings and business rules. `lib/store.js` reads and writes `data/db.json`, which holds the app’s records and audit log.

## Build, Test, and Development Commands

- `npm install` installs the Node.js dependencies. The app has no build step.
- `npm start` runs `node server.js`. Open `http://localhost:3000` or set `PORT` to use another port.
- `node --check routes/orders.js` checks JavaScript syntax. Substitute the path of each changed JavaScript file.

## Coding Style & Naming Conventions

Use two-space indentation, camelCase identifiers, and lowercase module filenames. Follow the surrounding JavaScript style, including CommonJS `require` and `exports` on the server and plain browser JavaScript in `public/js/app.js`. Keep HTTP handling in the routers and reuse existing helpers in `lib/`. The repository has no configured linter or formatter.

## Testing Guidelines

There is no automated test suite, coverage target, or test naming convention. `npm test` is a placeholder that exits with an error. Verify changes through the affected UI or API. For order changes, place an order and check totals, stock, the invoice, and the Khata balance when applicable. Use a disposable checkout for tests that write to `data/db.json`.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase summaries without a required prefix, such as `customer khata credit ledger and order cancellation`. Keep each commit focused. In pull requests, describe the behavior change and how you verified it, link any related issue, and include screenshots for visible UI changes.
