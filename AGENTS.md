# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Node.js/Express billing and inventory application. `server.js` wires the app and serves the UI; `routes/` contains API handlers; `lib/` holds business logic for orders, pricing, tax, inventory, reporting, invoices, and the ledger. Browser assets live in `public/` (`index.html`, `js/`, and `css/`). `data/db.json` is the local JSON store. There is no separate test or build directory currently.

## Build, Test, and Development Commands

- `npm install` installs the Express and body-parser dependencies.
- `npm start` starts the server on port 3000; set `PORT` to use another port.
- `npm test` is currently a placeholder that exits with an error because no test suite is configured. Do not treat it as a passing validation command.

There is no compilation or asset build step. Run the app with `npm start` and exercise the relevant UI or API route during development.

## Coding Style & Naming Conventions

Follow the existing CommonJS style (`require`/`module.exports`), two-space indentation, semicolons, and single-quoted strings. Keep route handlers in `routes/` and reusable business rules in `lib/`; use descriptive lower camelCase function and variable names. Match the surrounding code, which currently uses `var` and callback-based Express handlers rather than introducing a project-wide style change.

## Testing Guidelines

No testing framework, test files, or coverage requirement is configured. For changes to calculations or business rules, manually check representative cases (including boundaries such as insufficient stock, coupon caps, and tax slabs) and verify affected API responses or rendered pages. If adding automated tests, establish a test framework and update the npm scripts so `npm test` runs them.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, sentence-case summaries (for example, “basic pos ui and order history view”). Keep commits focused and describe the user-visible or business-rule change. Pull requests should explain the behavior changed, note manual or automated verification, link related issues when available, and include screenshots for UI changes.

## Data and Configuration

The app reads and rewrites `data/db.json`; preserve its existing structure and avoid replacing sample/business data casually. Keep runtime settings in `config.js` consistent with current modules. Do not commit real credentials or sensitive customer data; use environment variables for deployment-specific settings.
