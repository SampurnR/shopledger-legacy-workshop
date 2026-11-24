# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Node.js/Express POS and Khata ledger. `server.js` mounts the API and serves the browser app. `routes/` contains Express endpoints; `lib/` holds business logic for pricing, tax, inventory, orders, invoices, reporting, dates, storage, and customer ledgers. `config.js` contains shop settings and tax/coupon rules. The UI lives in `public/` (`index.html`, `js/app.js`, `css/style.css`). `data/db.json` is the local application store. `docs/architecture.svg` diagrams the modules. There is no test directory currently.

## Build, Test, and Development Commands

- `npm start` runs the server at the configured port (3000 by default).
- `npm test` is currently a placeholder that exits with “no test specified”; do not treat it as a test suite.

No build, lint, or formatting scripts are configured. Install dependencies with the package manager only when needed for local development, and avoid committing generated dependency directories.

## Coding Style & Naming Conventions

Follow the existing CommonJS JavaScript style: `var`, single-quoted strings, semicolons, and two-space indentation. Use `camelCase` for functions and variables, descriptive filenames such as `pricing.js`, and route modules that export an Express router. Keep HTTP handling in `routes/` and reusable business rules in `lib/`. Use `round2()` for monetary rounding and preserve the existing JSON data shape when changing persistence behavior.

## Testing Guidelines

No testing framework, test files, or coverage requirements are configured. For behavior changes, add focused tests if introducing a test runner, and document how to run them. Manually verify relevant endpoints and UI behavior in a development environment; include the cases checked in the change description.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, imperative summaries (for example, “support hsn gst slabs and coupon maxDiscount caps”). Follow that pattern and keep each commit focused. Pull requests should explain the behavior change, note affected routes/modules and data-file implications, link related work when available, and include screenshots for visible UI changes. Call out untested behavior explicitly.

## Security & Data Handling

Treat `data/db.json` as sensitive: it contains customer details and transaction history. Do not include real customer data in examples or test fixtures. Keep secrets out of source control; configuration currently includes an admin key and should be handled carefully.
