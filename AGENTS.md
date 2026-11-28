# Repository Guidelines

## Project Structure & Module Organization

This repository is a Node.js/Express point-of-sale and shop ledger app. `server.js` configures Express and mounts routes; `routes/` contains API handlers; `lib/` holds order, inventory, pricing, tax, ledger, invoice, date, coupon, report, and storage logic. Browser assets are in `public/` (`index.html`, `js/`, `css/`). `config.js` stores app settings, and `data/db.json` is the local data store. Architecture diagram: `docs/shopledger-architecture.svg`. There is no test directory.

## Build, Test, and Development Commands

- `npm start` runs `node server.js` and starts the app on port 3000 by default (override with `PORT`).
- No build command is configured; the UI is served as static files.
- `npm test` is a placeholder that exits with an error. No test framework or coverage requirement is configured.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, semicolons, single-quoted strings, and CommonJS `require`/`module.exports`. Use `camelCase` for variables and functions; keep filenames lowercase and descriptive, such as `routes/orders.js`. Keep route handling in `routes/` and reusable business logic in `lib/`. No formatter or linter is configured.

## Testing Guidelines

There are no automated tests yet. For behavior changes, describe the manual checks performed (for example, order creation, cancellation, coupon totals, and invoice reconciliation). Do not report `npm test` as passing; it currently reports that no test is specified.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`); follow that style unless the project adopts a formal convention. PRs should explain behavior changes, list verification steps, link related issues when available, and include screenshots for UI changes.

## Security & Configuration

Before staging or committing, review the full diff for tokens, passwords, keys, and other credentials. `config.js` contains a hardcoded admin credential: **warn whenever a credential could be committed**, and never repeat its value in docs or output. Always blur email addresses in responses and examples. Treat `data/db.json` as potentially sensitive; do not copy customer or business records into logs, examples, or documentation.
