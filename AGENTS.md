# Repository Guidelines

## Project Structure & Module Organization

The stack is Node.js with CommonJS JavaScript, Express 4, and body-parser, plus a plain HTML/CSS/browser-JavaScript UI. `server.js` serves `public/` and mounts the API routers in `routes/`: products, orders, customers, and reports. The `lib/` modules provide store access, order handling, inventory, pricing, tax, coupons, customer ledger, reports, invoice rendering, and dates. `config.js` holds shop settings and tax/coupon rules; `data/db.json` is the persistent store. The architecture diagram is in `docs/shopledger-architecture.svg`. There is no separate build output or existing test directory.

## Build, Test, and Development Commands

- `npm start` runs `node server.js` on the configured port (default `3000`). Use only when you intend to run the app.
- `node --test` runs Node.js's built-in test runner. Use it for tests; no test files are currently present.
- `npm test` currently exits with “no test specified”; it does not run the test runner.

There is no build, lint, or formatting script. The app uses Node.js and the dependencies declared in `package.json`; do not assume a frontend compilation step.

## Coding Style & Naming Conventions

Match the existing CommonJS JavaScript style: `require`, `module.exports`, `var`, semicolons, and two-space indentation. Use lowercase filenames, with route files named for their resource (for example, `routes/orders.js`) and business logic in focused `lib/` modules. Keep HTTP parsing and response handling in routes; put reusable calculations and state operations in `lib/`. Preserve the existing JSON data shape unless a change also updates all readers and writers.

## Testing Guidelines

Before changing behaviour, write characterization tests that record the current behaviour, including incorrect behaviour. Use `node --test` to run tests. Tests must never read from or write to the real `data/db.json`; use in-memory data or temporary copies instead. No coverage threshold is configured.

## Change Scope

Change only the module relevant to the selected ticket. Avoid unrelated refactoring. Do not add dependencies; use the existing stack and Node.js built-ins.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase summaries describing the feature or fix (for example, `support hsn gst slabs and coupon maxDiscount caps`). Follow that style. Pull requests should explain behavior changes, list manual or automated checks, note any `data/db.json` shape changes, and include UI screenshots when the browser interface changes. Link a related issue when one exists.

## Security & Configuration

Do not commit real customer data, credentials, or private shop details. Review `config.js` before deployment: it contains shop configuration and an admin export key. API authentication and durable database storage are not configured as general infrastructure in this repository; do not expose the app publicly without addressing access controls and data protection.
