# Repository Guidelines

## Project Structure & Module Organization

This is a small CommonJS/Express shop billing application. `server.js` wires the app and mounts API routers from `routes/`. Business logic is in `lib/` (orders, stock, pricing, coupons, tax, khata ledger, invoices, reports, dates, and JSON storage). The browser interface lives in `public/` (`index.html`, `js/app.js`, and `css/style.css`). `config.js` contains shop settings and tax, inventory, and coupon rules. `data/db.json` is the local application data store. The architecture diagram is in `docs/architecture.svg`. There is no test directory currently.

## Build, Test, and Development Commands

- `npm start` starts the Express server on port 3000, or `PORT` if set.
- `npm test` is currently a placeholder that exits with an error; no test suite is configured.

There is no separate build, lint, or formatting command. Dependencies are declared in `package.json`; do not assume a generated build step.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: CommonJS `require`/`module.exports`, two-space indentation, semicolons, single-quoted strings, and `var` declarations. Use lowercase filenames such as `pricing.js`; export focused functions and keep HTTP handling in route modules. Preserve the existing JSON response shape when changing an endpoint. No formatter or linter is configured.

## Testing Guidelines

No test framework, tests, or coverage requirements are present. For changes, add focused tests if introducing a test framework is part of the work; otherwise describe the relevant manual verification. Avoid treating the current `npm test` placeholder as a passing test run.

## Development & Testing Rules

1. **Characterization tests first**: Write characterization tests using `node:test` that pin today's behaviour before changing any code.
2. **One module only**: Change only the module(s) directly related to your ticket.
3. **Never touch `data/db.json`**: Tests must use in-memory fixtures and must never read, write, or mutate `data/db.json`.
4. **No new dependencies**: Do not add any new packages to `package.json`. Use Node.js built-ins (like `node:test` and `node:assert`).

## Commit & Pull Request Guidelines

Recent history uses short, lowercase, descriptive subjects (for example, `support hsn gst slabs and coupon maxDiscount caps`), without a required prefix. Keep commits focused. Pull requests should explain the user-visible or data impact, list verification performed, link related issues when available, and include screenshots for browser UI changes.

## Data & Configuration Safety

`data/db.json` is application data and is rewritten by the app. Do not reset or replace it casually; use a disposable copy for local experiments. Keep environment-specific settings out of committed changes, and do not expose admin credentials or customer data in logs, screenshots, or pull requests.
