# ShopLedger contributor instructions

## Current stack and commands

- CommonJS JavaScript on Node.js 22+, Express 4, and body-parser.
- Plain HTML, CSS, and browser JavaScript; no build step.
- `npm install` installs existing dependencies. Do not commit the generated package-lock.json.
- `npm start` starts server.js on PORT or port 3000.
- `node --test` runs the tests. The original `npm test` script is a failing placeholder.

## Module map

- `server.js`: static UI, four API routers, printable invoice endpoint.
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, `routes/reports.js`: HTTP adapters.
- `lib/orders.js`: order creation, lookup, cancellation, and listing.
- `lib/dates.js`: display dates, comparison keys, fiscal years.
- `lib/ledger.js`: customer credit accounts and settlements.
- `lib/inventory.js`: sellable stock, stock checks, deductions, releases.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, `lib/invoice.js`: checkout and invoice calculations.
- `lib/reports.js`: dashboard and GST reconciliation.
- `lib/store.js`: synchronous persistence in `data/db.json`.
- `config.js`: shop settings, tax slabs, coupon settings, inventory settings.
- `public/`: browser interface.

## Required workflow

- Read the relevant code before editing it.
- Write passing characterization tests before changing behavior. Name known incorrect behavior `CURRENT BEHAVIOUR`.
- Show a regression test failing before fixing the corresponding defect.
- The user selected Ticket 3 and authorized its affected modules: production changes belong only in `lib/orders.js`, `lib/dates.js`, and `lib/ledger.js`.
- Keep changes small. Tests and workshop documentation are supporting deliverables.
- Automated tests use independent in-memory fixtures. Never read or write `data/db.json` in tests.
- Reproduce the running app on a temporary project copy; preserve this checkout's `data/db.json` byte for byte.
- Add no dependencies and do not upgrade existing packages.
- Run `node --test` and review the diff before committing.
- Use a `fix/` branch, push to the participant's fork, open a PR into main, and do not merge.
- Do not commit secrets, real participant contact details, node_modules, package-lock.json, or temporary runtime databases.
