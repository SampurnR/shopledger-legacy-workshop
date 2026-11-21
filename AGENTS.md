# ShopLedger contributor guidance

## Stack

- Node.js application using Express 4 and `body-parser`.
- Server entry point: `server.js`.
- Browser UI: static HTML, CSS, and vanilla JavaScript in `public/`.
- Persistence: the single JSON file `data/db.json`, accessed synchronously through `lib/store.js`.
- Package manager lockfile: `package-lock.json`.

## Module map

- `server.js` configures Express, serves `public/`, mounts the API routers, and renders invoice pages.
- `routes/` contains the HTTP handlers: `products.js`, `orders.js`, `customers.js`, and `reports.js`.
- `lib/store.js` reads and writes the JSON database and audit log.
- `lib/inventory.js`, `lib/orders.js`, `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, and `lib/ledger.js` implement the business logic.
- `lib/invoice.js` renders invoices; `lib/reports.js` produces dashboard and GST-reconciliation data; `lib/dates.js` provides date helpers.
- `config.js` contains the port, shop metadata, tax configuration, inventory defaults, and coupons.

## Commands

```powershell
npm start          # starts node server.js
npm test           # currently exits with "Error: no test specified"
node --check server.js
```

## Change rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
