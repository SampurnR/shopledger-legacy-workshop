# ShopLedger

ShopLedger is a small internal billing, inventory, and customer-credit (Khata) application for a wholesale and retail shop. It provides a browser-based order desk, stock checks, GST calculations, printable invoices, customer settlements, and operational reports.

> This is a server-backed Node.js app. The GitHub Pages site is a project overview only; it cannot run the order APIs or update the JSON data store.

## GitHub Pages URL

[https://muhamed-kanapiya.github.io/shopledger-legacy-workshop/](https://muhamed-kanapiya.github.io/shopledger-legacy-workshop/) (available after GitHub Pages is enabled for the `docs/` folder)

## Features

- Product catalogue with stock and reorder visibility.
- Order creation with HSN-based GST and coupon pricing.
- Cash, UPI, and Khata credit payment modes.
- Customer credit limits and settlement records.
- Printable HTML tax invoices.
- Dashboard and GST reconciliation views.

## Architecture

![ShopLedger architecture](docs/architecture.svg)

The Express server in `server.js` serves the browser UI in `public/` and mounts routes from `routes/`. Business logic lives in `lib/`; `data/db.json` is the application's JSON data store.

## Run locally

Requirements: Node.js (verified in this repository with Node 22.9.0).

```powershell
npm ci
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Test

```powershell
node --test
```

`npm test` is not configured and currently exits with an error, so use the command above.

## Data and development notes

- Application data is stored in `data/db.json`.
- Tests must use in-memory fixtures and must never modify `data/db.json`.
- Do not add dependencies without an explicit decision to do so.
- See [AGENTS.md](AGENTS.md) for contributor rules and the module map.

## GitHub Pages

The static companion site is sourced from `docs/`. It documents the project and links back to the local-run instructions. GitHub Pages cannot host this Express application itself because the API routes and JSON writes require a Node.js server.
