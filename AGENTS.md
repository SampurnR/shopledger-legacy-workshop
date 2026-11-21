# ShopLedger contributor instructions

## Stack and commands

- CommonJS JavaScript, Node.js, Express 4, body-parser; plain HTML/CSS/browser JavaScript.
- Use Node 22 or newer for workshop work. `npm start` starts `server.js` (default port 3000; override with `PORT`).
- `node --test` runs tests. The legacy `npm test` script is a placeholder that exits with an error.
- Dependencies are already installed locally. Do not add dependencies.

## Module map

- `public/`: POS, order history, customer Khata, inventory/GST audit UI.
- `server.js`: static hosting, four `/api` routers, printable invoice endpoint.
- `routes/`: products/coupons, orders/cancellation, customers/settlements, reports/preview/export.
- `lib/pricing.js`, `coupons.js`, `tax.js`: checkout totals, coupon eligibility/caps, HSN GST and splitting.
- `lib/invoice.js`: invoice figures and printable HTML.
- `lib/inventory.js`: sellable stock, deductions and releases.
- `lib/orders.js`, `dates.js`: order records, history, cancellation and date helpers.
- `lib/ledger.js`: customer balances, credit charging and settlements.
- `lib/reports.js`: dashboard and invoice/ledger reconciliation.
- `lib/store.js`: synchronous JSON persistence and audit entries.
- `config.js`: shop settings, tax slabs, coupons, inventory settings and export key.
- `data/db.json`: application database, not a test fixture.

## Required workflow

1. Write and run characterization tests before changing behavior. Label known defects `CURRENT BEHAVIOUR`.
2. Limit production changes to the module(s) for the selected ticket. This submission selects Ticket 1: `lib/invoice.js`.
3. Tests must use in-memory synthetic fixtures; never read or write `data/db.json`. For manual app reproduction, use a temporary project copy with its own database.
4. Add no dependencies. Use built-in `node:test` and `node:assert/strict`.
5. Show a regression test failing before the fix, then passing. Review the diff and run the complete suite.
6. Preserve the original application database and unrelated production files. Do not include the locally generated `package-lock.json` in the workshop submission.
7. Never merge the submission PR. Do not commit credentials or personal submission-form details.
