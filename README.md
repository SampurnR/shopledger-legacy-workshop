# ShopLedger

ShopLedger is a small Express application for retail and wholesale billing, inventory, customer credit (khata), GST calculations, and printable invoices. It serves a browser POS and stores records in a local JSON file.

## Screenshots

Captured from the seeded local application:

### Point of sale

![ShopLedger product catalog and point-of-sale screen](docs/screenshots/catalog-pos.png)

### Order history and dispatch

![ShopLedger order history with dispatch actions](docs/screenshots/order-history.png)

### GST invoice

![Corrected invoice for order 1002](docs/screenshots/invoice-1002.png)

## Features

- Product catalog with sellable and reserved stock, HSN GST slabs, and reorder indicators.
- POS checkout with coupons, cash/UPI/khata payment modes, and immediate or pending fulfillment.
- Order history with date filters, cancellation, dispatch completion, and printable invoices.
- Customer balances, credit limits, and settlement tracking.
- Dashboard and GST reconciliation reports.
- Request retry protection and atomic, serialized writes to the JSON store.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to use another port. Run the regression suite with:

```sh
npm test
```

There is no separate build command. The application uses CommonJS, Express 4, `body-parser`, and browser-native JavaScript/CSS.

## Project map

- `server.js` mounts the static UI and API routes.
- `routes/` contains product, order, customer, and report endpoints.
- `lib/` contains inventory, pricing, tax, coupon, order, ledger, invoice, report, date, and storage logic.
- `public/` contains the browser UI; `data/db.json` is the local data store.
- `test/` contains `node:test` regression coverage.
- [Architecture diagram](docs/shopledger-architecture.svg) shows the main modules and order flow.

## Data and security notes

`data/db.json` contains the seeded records and is modified by normal app writes. Back it up before local experiments; tests use isolated data. The admin export currently relies on a hard-coded key in `config.js`, so replace it and review access controls before exposing this app to an untrusted network.

## Contributor and agent notes

Read [AGENTS.md](AGENTS.md) before changing code. GitHub issue and domain documentation live in [`docs/agents/`](docs/agents/). Keep changes focused, add characterization tests before behavior changes, and do not add dependencies.

For issue-to-test traceability, screenshots, and reproduction notes, see the [Codex evidence pack](docs/codex-evidence-pack.md).

The Jules issue-automation fleet is not configured in this repository. Its setup requires GitHub Actions workflows, a `JULES_API_KEY` repository secret, and review of its scheduled dispatch and PR-merge behavior. Do not assume the automation is active.
