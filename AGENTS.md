# Repository Guidelines

## Stack and Project Map

ShopLedger is a CommonJS application running on Node.js and Express 4. `server.js` creates the app, serves `public/`, and mounts the API routes. `routes/` contains product, order, customer, and report endpoints. `lib/` contains the corresponding business logic, including pricing, tax, coupons, inventory, orders, ledger, invoices, reports, dates, and JSON storage. `config.js` holds application settings. `data/db.json` is the local JSON data store; `docs/architecture.svg` is the architecture diagram.

The browser client is in `public/index.html`, `public/css/`, and `public/js/`. `work/` is present but currently has no tracked files.

## Commands

- `npm start` starts the server with `node server.js` (default port 3000; set `PORT` to override).
- `npm test` currently prints “Error: no test specified” and exits with status 1. No test framework or build command is configured in `package.json` today.

## Change and Test Rules

- Before changing behavior, write characterization tests that capture the existing behavior and the intended change.
- Keep a ticket’s changes limited to the module that ticket concerns; avoid unrelated cleanup or cross-module edits.
- Tests must never read from or write to `data/db.json`. Use isolated temporary data or stubs for storage behavior.
- Do not add dependencies. Use the existing Node.js and Express stack.

## Code Style

Follow the existing style: CommonJS `require`/`module.exports`, semicolons, single-quoted strings, and two-space indentation. The current server and modules use `var` and callback functions; match nearby code when editing rather than introducing a repository-wide style change. Use descriptive lowercase filenames such as `lib/inventory.js` and `routes/products.js`.

## Commits and Pull Requests

Recent commits use short, lowercase, descriptive summaries (for example, `invoice page for accountant`). Keep commits focused. Pull requests should explain the behavior change, identify the affected module, link the relevant ticket when available, and include screenshots for visible UI changes. State how changes were checked, including when checks cannot run because no test suite is configured.
