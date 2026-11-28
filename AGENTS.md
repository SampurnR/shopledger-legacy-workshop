# Repository Guidelines

## Stack

ShopLedger uses Node.js with CommonJS, Express 4, and body-parser. Express serves plain HTML, CSS, and browser JavaScript directly from `public/`. Application data lives in `data/db.json`.

## Module Map

- `server.js` starts Express, mounts the API, serves the UI, and handles printable invoices. `config.js` holds the port and shop settings.
- `routes/` handles product, order, customer, and report requests.
- `lib/` contains business logic and invoice rendering. `lib/store.js` reads and writes the JSON database.
- `public/` contains the browser UI.

## Commands

- `npm install` installs the existing dependencies.
- `npm start` runs the app at `http://localhost:3000`. Use `PORT=3001 npm start` to override the port.
- `node --check routes/orders.js` checks JavaScript syntax. Substitute the file you changed.
- `npm test` is a placeholder that exits with status 1. There is no build script.

## Contribution Rules

- Write **characterization tests** before changing behaviour. Run them against the existing implementation to capture what it does today.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`. Use in-memory fixtures or temporary files for test data.
- Add no dependencies.
