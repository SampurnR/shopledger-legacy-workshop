# Repository Guidelines

## Stack and Module Map

This is a CommonJS Node.js application using Express 4 and `body-parser`. The browser UI uses plain JavaScript, `XMLHttpRequest`, HTML, and CSS without a frontend framework or build step.

- `server.js` creates the Express app, serves `public/`, and mounts routers.
- `routes/` handles product, order, customer, and report API requests.
- `lib/` contains order and inventory logic, pricing, coupons, tax, customer ledger, reports, invoice rendering, date helpers, and JSON file storage.
- `config.js` holds shop and business settings. `data/db.json` holds application data.
- `public/` contains the UI. `docs/` contains the architecture diagram.

## Commands

- `npm start` runs `node server.js` and listens on port 3000 by default. `PORT` can override the port.
- `npm test` currently exits with “no test specified.” No test framework or build command is configured.

## Change Rules

- Before changing behavior, write characterization tests that capture the existing behavior and the intended case being changed.
- Change only the module the ticket is about. Keep edits within that module unless the ticket explicitly requires otherwise.
- Tests must never read or write `data/db.json`. Use isolated test data.
- Add no dependencies.

## Code Conventions

Follow surrounding code: two-space indentation, semicolons, CommonJS `require`/`module.exports`, and lowercase filenames such as `routes/orders.js` and `lib/pricing.js`. Preserve existing API shapes and JSON field names unless the ticket requires a behavior change.
