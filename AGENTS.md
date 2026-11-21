# Repository Guidelines

## Project Structure & Module Organization

This is a small CommonJS Node/Express POS application. `server.js` wires middleware, static files, and routes; `routes/` contains API handlers; `lib/` contains business logic for pricing, taxes, coupons, orders, inventory, Khata, reporting, invoices, dates, and JSON storage. The browser UI lives in `public/` (`index.html`, `js/app.js`, `css/style.css`). `config.js` holds shop and application settings. `data/db.json` is the local application store; `docs/` contains project documentation and diagrams. There is no test directory or test suite currently.

## Build, Test, and Development Commands

- `npm start` runs `node server.js` and starts the app on port 3000 by default; set `PORT` to choose another port.
- `npm test` is currently a placeholder that exits with “no test specified”; do not treat it as a passing test suite.
- There is no build, lint, or formatting command configured. For changes, manually review affected routes, library logic, and UI behavior. Do not add dependencies without a clear need.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: CommonJS `require`/`module.exports`, two-space indentation, semicolons, and single-quoted strings. Use lower camel case for functions and variables, and descriptive filenames in lowercase (for example, `gst-reconciliation` route paths and `computeTotals`). Keep route handlers thin and put reusable business rules in `lib/`. Preserve the existing JSON data shape when changing persistence behavior.

## Testing Guidelines

No testing framework or coverage requirement is configured. If adding tests, introduce a clear test command and use filenames such as `pricing.test.js`. Cover order totals, coupon limits, GST slabs, stock boundaries, Khata balance changes, and invoice reconciliation when changing those behaviors. Never rely on `npm test` until it invokes actual tests.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `invoice page for accountant`). Follow that style and keep each commit focused. Pull requests should explain the user-visible change, note affected API or stored-data behavior, link related issues when available, and include screenshots for UI changes. Call out any required data migration or manual verification steps.

## Security & Configuration

Do not commit real customer data, credentials, or secrets. `data/db.json` contains operational records, and `config.js` currently includes an admin key; handle both carefully. Validate request data on the server and avoid inserting untrusted values into HTML.
