# ShopLedger Legacy Workshop

## Project purpose

ShopLedger is a small-shop billing and inventory app. Its UI includes point-of-sale orders, order history, customer Khata accounts, inventory, and GST reconciliation.

## Technology and commands

- Node.js with Express; the browser UI uses HTML, CSS, and plain JavaScript.
- Data is stored in `data/db.json`.
- Workshop runtime target: Node.js 22 or newer. The repository's `package.json` does not declare an `engines` field.
- Install the declared dependencies with `npm.cmd install` in PowerShell (approval is required before installing).
- Start the app with `npm.cmd start`; it runs `node server.js` and defaults to port 3000.
- Run tests with `node --test`. The current `npm test` script is a placeholder that exits with an error; no test files are present in the starting checkout.

## Folder and module map

- `public/index.html`, `public/js/app.js`, `public/css/style.css`: browser interface and client behavior.
- `routes/`: Express API routers for products/coupons, orders, customers/Khata, and reports/pricing preview.
- `lib/`: business logic for coupons, dates, inventory, invoice rendering, ledger/Khata, orders, pricing, reports, JSON storage, and tax.
- `config.js`: port, shop information, tax slabs, coupon rules, and inventory settings.
- `data/db.json`: sample products, customers, orders, settlements, and audit entries.
- `server.js`: Express setup, static UI hosting, router mounting, and the printable invoice endpoint.
- `docs/architecture.svg`: architecture diagram for this workshop.

## Required change and test practices

1. Write characterization tests for current behavior before changing behavior.
2. Make the smallest change and edit only the module or modules relevant to the selected ticket.
3. Tests must never modify the repository's original `data/db.json`. Use in-memory fixtures or a temporary isolated copy; ensure tests cannot call the production store writer against the original path.
4. Add no dependencies.
5. Do not reset, delete, or overwrite existing work. Do not force-push.
6. Do not claim tests passed unless the command was actually run and its output was checked.
