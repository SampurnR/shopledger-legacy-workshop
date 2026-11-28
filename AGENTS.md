# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Express application with a static browser UI. `server.js` starts the app and mounts API routers in `routes/`. Business logic lives in `lib/` (orders, pricing, tax, inventory, coupons, ledger, reports, invoices, dates, and JSON storage). The UI is in `public/` (`index.html`, `js/app.js`, and `css/style.css`). `config.js` contains shop and application settings; `data/db.json` is the current local data store and seed data. Architecture reference: `docs/architecture.svg`. There is no test directory currently.

## Build, Test, and Development Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js` and serves the app on port 3000 by default; set `PORT` to override it.
- `npm test` is only a placeholder and exits with an error; no test framework or build step is configured.

Do not point local experiments at important `data/db.json` contents: order, settlement, and cancellation requests rewrite this file.

## Coding Style & Naming Conventions

Follow the existing CommonJS JavaScript style: two-space indentation, single-quoted strings, semicolons, and callback-based Express handlers. Use lowercase, descriptive filenames (for example, `routes/orders.js`) and export module functions through `exports`. Keep route parsing and HTTP responses in `routes/`; put reusable business rules in `lib/`. No formatter or linter is configured, so match nearby code and keep changes focused.

## Testing Guidelines

There is no configured automated test suite. Do not treat `npm test` as validation. For behavior changes, add focused tests if introducing a test framework is in scope; otherwise describe the manual checks performed and avoid running them against valuable local data.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`), without a required prefix. Keep commit subjects concise and imperative where practical. Pull requests should explain the user-visible or data-flow change, list verification performed, link related issues when available, and include screenshots for UI changes. Call out changes to persisted data formats or billing calculations.

## Security & Configuration

Review `config.js` before exposing the app beyond a trusted local environment: it contains an admin key and shop settings. Keep real credentials out of commits. Treat exported database contents and `data/db.json` as sensitive business and customer data.
