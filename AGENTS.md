# Repository Guidelines

## Project Structure & Module Organization

`server.js` starts the Express app, serves static assets, mounts `routes/` under `/api`, and handles printable invoices. Keep HTTP handling in `routes/` and reusable pricing, inventory, Khata, reporting, and persistence logic in `lib/`. The browser UI lives in `public/index.html`, `public/js/app.js`, and `public/css/style.css`. Shop settings, GST slabs, and coupon rules live in `config.js`. The app reads and writes `data/db.json` through `lib/store.js`.

## Build, Test, and Development Commands

- `npm install` installs the runtime dependencies from `package.json`.
- `npm start` runs `node server.js`. Open `http://localhost:3000` or set `PORT` to choose another port.
- `npm test` runs a placeholder that exits with status 1. There is no build step, lint command, or formatter configuration.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and semicolons in JavaScript. Follow the existing CommonJS style with `require()`, `exports`, and `module.exports`. Use lowercase filenames such as `pricing.js` and camelCase names such as `computeTotals()`. Keep changes focused and follow the surrounding style.

## Testing Guidelines

The repository has no automated test suite, test naming convention, or coverage target. Use a disposable copy of the repo for checks that write data, since order placement and settlements update `data/db.json`. For billing changes, compare the cart preview, saved order, printable invoice, and GST reconciliation report. Record expected and actual figures for a mixed-slab cart and a coupon at its minimum or cap. For inventory or Khata changes, check stock and credit balances after placement, cancellation, or settlement as applicable.

## Commit & Pull Request Guidelines

Use short, descriptive commit subjects. Existing examples are lowercase and unprefixed, such as `invoice page for accountant`. In pull requests, describe the behavior change and how you verified it. Link the relevant issue when available and include screenshots for visible UI or printable invoice changes. Keep test transactions, customer data, and credentials out of diffs.
