# Repository Guidelines

## Stack

ShopLedger runs on Node.js with CommonJS modules, Express 4, and body-parser. Express serves static HTML, CSS, and browser JavaScript. The application stores its data in a JSON file.

## Module map

- `server.js` mounts the API routers, serves `public/`, and handles the printable invoice route.
- `config.js` defines shop settings, tax slabs, and the listening port.
- `routes/` contains the product, order, customer, and report handlers mounted under `/api`.
- `lib/` contains pricing, coupon, tax, inventory, order, ledger, reporting, date, and invoice logic. `lib/store.js` handles persistence in `data/db.json`.

## Commands

- `npm install` installs the existing dependencies.
- `npm start` runs `node server.js` on port 3000 by default. Use `PORT=3001 npm start` to select another port.
- `npm test` runs a placeholder that prints “Error: no test specified” and exits with status 1.

## Contribution rules

1. Before changing behaviour, write characterization tests that capture the module’s current behaviour and run them against the existing code.
2. Change only the module the ticket is about.
3. Tests must never read from or write to `data/db.json`. Use isolated fixtures.
4. Add no dependencies.
