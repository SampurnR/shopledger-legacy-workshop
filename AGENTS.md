# Repository Guidelines

## Stack

ShopLedger is a Node.js application using CommonJS, Express, and body-parser. Its browser interface uses plain HTML, CSS, and JavaScript. Application records are stored in `data/db.json`.

## Module Map

- `server.js` creates the Express app, serves `public/`, and mounts the API routes.
- `routes/` contains product, order, customer, and report endpoints.
- `lib/` contains pricing, tax, coupon, inventory, order, ledger, invoice, report, date, and JSON store logic.
- `public/` contains the browser UI and its styles and scripts; `config.js` holds server configuration.

## Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` starts the server with `node server.js`.
- `npm test` currently exits with an error because no test command is configured.

## Change Rules

- Before changing behavior, write characterization tests that capture the current behavior.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Do not add dependencies.
