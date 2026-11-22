# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS JavaScript. Its browser UI is plain HTML, CSS, and JavaScript. Application data is stored in `data/db.json`.

## Module Map

- `server.js` starts Express, serves `public/`, mounts routes, and exposes the printable invoice page.
- `public/` contains the browser UI and its styles and client-side code.
- `routes/` contains the Express API modules for products, orders, customers, and reports.
- `lib/` contains order, inventory, pricing, tax, coupon, ledger, report, invoice, date, and JSON-store logic.
- `config.js` contains the port, shop details, tax slabs, coupons, and inventory defaults.
- `data/db.json` is the application data file.

## Commands

- `npm start` runs `node server.js` (port 3000 unless `PORT` is set).
- `npm test` is currently a placeholder that exits with an error; no test framework or test suite is configured.

## Change Rules

- Write characterization tests before changing behaviour. The repository does not currently have a test framework, so account for that when preparing a behaviour change.
- Change only the module the ticket is about. Keep edits within the relevant module unless the ticket requires otherwise.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Add no dependencies. Do not add packages to `package.json` or change the lockfile to support a change.
