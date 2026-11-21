# ShopLedger

## Stack
- Node.js with Express 4 and CommonJS modules.
- Browser UI served as static files from `public/`.
- JSON persistence in `data/db.json`.
- Built-in `node:test` is available; there is no configured test script yet.

## Module map
- `server.js` wires Express middleware, API routers, and the printable invoice route.
- `routes/` exposes products, orders, customers, and reports endpoints.
- `lib/` contains pricing, tax, inventory, order, ledger, reporting, storage, and invoice logic.
- `config.js` holds shop, tax, coupon, and inventory settings.
- `data/db.json` is the persisted application data.
- `public/` contains the browser interface, JavaScript, and CSS.

## Commands
- `npm install` installs the existing dependencies.
- `npm start` starts the app at `http://localhost:3000`.
- `node --test` runs Node's built-in test discovery.

## Working rules
- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`; use in-memory data.
- Add no dependencies.
