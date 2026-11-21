# ShopLedger working instructions

## Stack and module map

Node.js, Express, body-parser, CommonJS, static HTML/CSS/JavaScript frontend,
and synchronous JSON-file persistence. `server.js` mounts four API routers and
renders printable invoices. `public/index.html` is the UI; `public/js/app.js`
handles browser requests. `routes/` contains products, orders, customers and
reports. `lib/` contains coupons, dates, inventory, invoice, ledger, orders,
pricing, reports, store and tax. `config.js` defines shop/tax/coupon settings.
`data/db.json` holds products, orders, customers, settlements and audit entries.

## Commands

- Install existing dependencies: `npm install` (do not commit package-lock.json).
- Start: `npm start` (node server.js; PORT defaults to 3000).
- Tests: `node --test` using Node's built-in test runner. The existing `npm test`
  script is a placeholder that exits with failure; do not use it as validation.
- No CI or general authentication infrastructure is present in this repository.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must never touch the tracked data/db.json.
4. Add no new dependencies.

Selected scope: Ticket 1, invoice/GST reconciliation. Reproduce with a temporary
project copy; never start the real project against tracked data for testing.
Do not fix inventory, dates or settlement tickets. Do not commit package-lock.json.
