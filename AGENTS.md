# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Node.js/Express point-of-sale app. `server.js` wires middleware, static assets, routers, and the printable invoice endpoint; `config.js` holds shop, tax, coupon, inventory, and port settings. API handlers live in `routes/`. Business logic is split across `lib/` (pricing, tax, coupons, inventory, orders, ledger, reports, dates, invoice, and JSON storage). The browser UI is in `public/` (`index.html`, `js/app.js`, `css/style.css`). Persistent sample/runtime data is `data/db.json`; architecture documentation is in `docs/`. There is no test directory or test suite currently.

## Build, Test, and Development Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js`; by default the app listens on port 3000. Set `PORT` to choose another port.
- `npm test` is a placeholder that exits with an error (“no test specified”); do not treat it as a passing test suite.

There is no separate build or lint command. For changes to calculations or data handling, manually verify representative cases and describe the checks performed in the pull request.

## Coding Style & Naming Conventions

Follow the existing CommonJS style (`require` / `module.exports`) and use two-space indentation. Keep route handlers thin and put reusable business rules in `lib/`. Use lower camel case for functions and variables, descriptive lower-case filenames such as `pricing.js`, and uppercase constants for fixed values. Preserve the project’s existing semicolon and single-quoted string style. No formatter or linter is configured.

## Testing Guidelines

No framework, coverage threshold, or test naming convention is established. If adding tests, introduce a clear repeatable command and document it; name tests after the module or behavior, for example `pricing.test.js`. Cover rounding, GST slab selection, coupon limits, stock boundaries, and Khata balance updates when touching those paths.

## Commit & Pull Request Guidelines

Recent commits use short, lower-case descriptive summaries (for example, `invoice page for accountant`), without a visible ticket prefix. Follow that style and keep each commit focused. Pull requests should explain the change, list relevant routes/modules, include verification steps, and attach UI screenshots when relevant. Call out persisted JSON or checkout/invoice calculation changes.

## Security & Data Handling

Do not commit real customer data, credentials, or secrets. `data/db.json` is the application’s local JSON store; avoid hand-editing live records as part of unrelated changes. Treat shop settings, admin access, and financial calculations as sensitive, and validate untrusted request values at the route boundary.
