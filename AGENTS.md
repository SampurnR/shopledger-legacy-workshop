# Repository Guidelines

## Project Structure & Module Organization

This is a small Node.js/Express application. `server.js` wires the app and serves `public/` (HTML, browser JavaScript, and CSS). API handlers live in `routes/`; business logic is in `lib/`, grouped by orders, inventory, pricing, tax, coupons, ledger, reports, dates, invoices, and JSON storage. `config.js` contains shop, tax, coupon, and inventory settings. `data/db.json` is the local application dataset. Architecture documentation belongs in `docs/`. There is no test directory or test suite currently.

## Build, Test, and Development Commands

- `npm start` starts the app on port 3000 by default; set `PORT` to override it.
- `npm test` is currently a placeholder that exits with an error; do not treat it as a passing test suite.
- No build, lint, or formatter command is configured. Dependencies are declared in `package.json` and locked in `package-lock.json`.

## Coding Style & Naming Conventions

Match the existing CommonJS JavaScript style: `require()` imports, `module.exports`/`exports`, single-quoted strings, semicolons, and `var` declarations. Use two-space indentation. Use lowercase filenames (`orders.js`) and descriptive camelCase function and variable names. Keep route handlers focused on request/response behavior and put reusable business rules in `lib/`. Avoid adding dependencies or tooling without a clear need.

## Testing Guidelines

There is no configured test framework, coverage target, or test naming pattern. For behavior changes, add focused tests if introducing a test framework is in scope; otherwise document the manual verification steps and affected routes. Do not claim `npm test` validates the application: it intentionally reports that no test is specified.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`); no formal prefix convention is evident. Keep commits focused. Pull requests should describe the behavior change, list relevant routes/modules, note data or configuration impacts, and include screenshots for visible UI changes. Record test or manual verification results and link related issues when available.

## Security & Data Handling

Treat `data/db.json` as application data, not a disposable fixture; do not overwrite or commit local operational changes unintentionally. Keep secrets out of source control. The current app has limited built-in access controls, so review exposure and authorization carefully when changing routes or deployment configuration.
