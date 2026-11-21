# ShopLedger engineering guide

## Stack and launch

ShopLedger is a Node.js CommonJS application using Express and body-parser. The frontend is plain HTML, CSS, and browser JavaScript. Persistence is a JSON file accessed synchronously through Node's filesystem APIs.

From the repository root, `npm start` runs `node server.js`; `node server.js` is the equivalent direct command. The port is `PORT` when set, otherwise 3000. Starting the application is not required for isolated unit tests.

## Repository map

- `server.js` creates the Express app, serves `public/`, mounts the API routers, and serves the printable invoice route.
- `config.js` contains the port, shop details, tax slabs, inventory settings, coupons, and admin export key.
- `public/index.html`, `public/css/style.css`, and `public/js/app.js` implement the browser interface and HTTP interactions.
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, and `routes/reports.js` handle catalog, order, customer, and reporting requests respectively.
- `lib/inventory.js` handles stock checks and adjustments; `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate order prices, tax, and discounts.
- `lib/orders.js` manages order records and cancellation; `lib/ledger.js` handles customer credit and settlements; `lib/invoice.js` calculates and renders invoices; `lib/reports.js` builds dashboard and reconciliation summaries; `lib/dates.js` supplies date helpers.
- `lib/store.js` reads and writes `data/db.json` and adds audit entries. `data/db.json` holds the persistent application data.
- `docs/shopledger-architecture.svg` depicts the current architecture and order flow.

## Tests

`npm test` is a placeholder that prints an error and exits unsuccessfully; it is not a working test suite. With a Node.js version that supports the built-in test runner, run isolated tests using `node --test` or a specific test file using `node --test path/to/test-file.js`. No Node.js version is specified in `package.json`; check the local runtime before relying on this command.

Use fresh in-memory fixtures for business modules. Do not let tests call the real `store.read` or `store.write`, or otherwise access `data/db.json`; route tests require an isolated replacement for the store before handlers are exercised.

## Safe engineering rules

- Write characterization tests before changing existing behavior.
- Change only the module or modules belonging to the selected ticket.
- Never run tests against or modify `data/db.json`. Use isolated in-memory fixtures.
- Add no dependencies.
- Make the smallest correct change.
- Review diffs before committing.
