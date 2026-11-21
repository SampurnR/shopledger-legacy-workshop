# ShopLedger agent notes

## Stack

- Node.js CommonJS application with Express 4.
- JSON data is stored in `data/db.json` and accessed through `lib/store.js`.
- The browser UI is served from `public/`; API routers live in `routes/`.

## Module map

- `server.js`: Express app, static UI, API routers, and printable invoice route.
- `config.js`: shop settings, GST fallback, HSN slabs, and coupons.
- `routes/`: products, orders, customers, and reports HTTP endpoints.
- `lib/pricing.js`: subtotal, capped coupon discount, HSN-aware tax, and totals.
- `lib/invoice.js`: printable invoice HTML and invoice figures.
- `lib/store.js`: JSON database reads, writes, and audit entries.

## Commands

- Start the app with `npm start`.
- Run tests with `node --test`.

## Rules

1. Characterization tests come before changing behavior.
2. Only change modules covered by the ticket.
3. Tests use in-memory orders; never read or write `data/db.json`.
4. Do not add dependencies or commit `package-lock.json`.
5. Make the smallest fix that works and review the diff before publishing.

## Current ticket

Invoice and GST totals do not match checkout totals. The allowed implementation file is
`lib/invoice.js`; `lib/tax.js` may be changed only if the existing helper is insufficient.

