# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is an Express point-of-sale app for wholesale and retail billing, inventory, and khata (customer credit). `server.js` serves the browser UI from `public/`, mounts the routers in `routes/` under `/api`, and serves printable invoices. Keep request handling in the routers and business rules in `lib/`, which owns pricing, GST, coupons, stock, orders, customer balances, invoices, and reports. `config.js` holds shop settings and business defaults. `lib/store.js` reads and writes `data/db.json`. Keep documentation in `docs/`.

## Build, Test, and Development Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js` on port 3000 by default. Set `PORT` to use another port. Express serves the frontend directly, with no build step.
- `npm test` currently runs a placeholder that exits with an error. Use targeted checks for the behavior you change.

## Coding Style & Naming Conventions

Match neighboring code. Use two-space indentation, single quotes, semicolons, and CommonJS `require` and `exports` in server modules. Use lowercase module filenames such as `lib/pricing.js` and camelCase functions such as `computeTotals`. Keep browser code compatible with the existing plain JavaScript setup. The repository configures no linting or formatting tool.

## Testing Guidelines

The repository has no automated test suite, coverage threshold, or test naming convention. Document the checks you ran. For pricing or invoice changes, compare cart preview, saved order totals, and the printable invoice. For inventory and khata changes, check placement, cancellation, and settlements as applicable. Use disposable data for checks that write orders or settlements, since local writes persist to `data/db.json`.

## Commit & Pull Request Guidelines

Follow the history's short, descriptive commit subjects, such as `support hsn gst slabs and coupon maxDiscount caps`. In pull requests, describe the behavior changed and how you verified it. Link a related issue when one exists. Include screenshots for visible POS or invoice changes, and call out any impact on existing records or configuration.
