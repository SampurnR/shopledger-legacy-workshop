# Repository Guidelines

## Stack

This is a Node.js application using Express 4 and `body-parser`. It serves a browser UI as static files and persists application state in `data/db.json`. The code uses CommonJS modules and ES5-style JavaScript (`var`, `require`, and `module.exports`).

## Module Map

- `server.js` creates the Express application, serves `public/`, and mounts API routes.
- `routes/` contains HTTP handlers for products, orders, customers, and reports.
- `lib/` contains the application logic, including store access, inventory, pricing, tax, coupons, orders, ledgers, invoices, dates, and reports.
- `public/` contains the browser UI: `index.html`, `js/app.js`, and `css/style.css`.
- `data/db.json` is the application’s persisted data.
- `config.js` contains runtime configuration, including the port.

## Commands

- `npm install` installs the dependencies recorded in `package-lock.json`.
- `npm start` runs the application with `node server.js`; it listens on port 3000 unless `PORT` is set.
- `npm test` currently exits with an error because no test suite is configured.

## Change Rules

Write characterization tests before changing existing behaviour. Use those tests to record the current observable result, then make the requested change.

Change only the module the ticket is about. Do not make opportunistic refactors or edits in adjacent routes, UI files, configuration, or data.

Tests must never read from, write to, reset, or otherwise touch `data/db.json`; create test-local data in memory instead.

Do not add dependencies. Work with the packages and built-in Node.js capabilities already available in this repository.
