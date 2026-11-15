# Repository Guidelines

## Project Structure

- `server.js` starts the Express app. `routes/` contains products, orders, customers, and reports APIs; reusable business rules live in `lib/`.
- `public/` contains the vanilla HTML, CSS, and browser JavaScript UI. `config.js` holds shop, tax, coupon, port, and inventory settings.
- `data/db.json` is the synchronous file-backed store for products, orders, customers, settlements, and audit entries. Avoid committing real customer data.
- `test/characterization.test.js` records current behavior. `docs/architecture.svg` shows the architecture and order flow.

## Current Application State

- The app supports POS order creation, order history and cancellation, product/coupon lookup, customer Khata billing and settlements, dashboard summaries, GST reconciliation, and printable HTML invoices.
- `npm start` serves the UI and API on port 3000 by default; `PORT` can override it.
- Data is stored in one local JSON file. There is no database, migration system, general authentication, PDF invoice endpoint, frontend framework, formatter, or linter.
- The test suite includes passing examples of pricing, coupon, tax, and date behavior plus characterization cases that preserve known quirks: lexical date filtering, rejecting the last sellable unit, cancellation release lookup mismatch, and string settlement arithmetic. Revisit those assertions when fixing the behaviors.

## Development and Testing

- Run `npm install` to install declared dependencies, `npm start` to run locally, and `npm test` to run Node’s built-in test runner (`node --test`).
- Add tests under `test/` with the `*.test.js` suffix. Keep tests isolated with in-memory data; do not run order or settlement tests against the live `data/db.json`.
- There is no build step or coverage requirement. For changes, run `npm test` and manually inspect the affected UI/API path when relevant, especially totals, stock, balances, and invoice reconciliation.

## Coding Style

- Production code uses CommonJS, `var`, semicolons, single quotes, and two-space indentation. Match nearby code and use lower camel case for functions and variables.
- Keep request handling in `routes/` and reusable business logic in `lib/`. Route and module filenames are lowercase, such as `routes/orders.js` and `lib/pricing.js`.

## Commits and Pull Requests

- Recent commits use short, lowercase descriptive subjects, such as `invoice page for accountant`.
- PRs should summarize user-visible and API changes, report tests/manual checks, include screenshots for UI changes, and call out edits to `data/db.json` or `config.js`.

## Security

- Do not commit credentials or live customer data. The API has no general authentication; do not expose this app publicly without addressing access control.
