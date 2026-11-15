# CP1 Explain shopledger read-only

Reviewed upstream commit `68c85a9e1cb97c470b4bfd9d1a3f99488cec8639` without editing application files, installing packages, or starting the server during CP1.

## I am sure

ShopLedger is a synthetic wholesale and retail point-of-sale app. It maintains stock and wholesale holds, prices carts with coupons and HSN GST slabs, stores orders, bills customer Khata accounts, records settlements, prints invoices, and reports invoice-versus-ledger mismatches.

The stack is CommonJS Node.js, Express 4 and body-parser, with plain browser JavaScript, HTML and CSS. `lib/store.js` reads and writes a JSON file synchronously. There is no application build step, no original README, and no original test suite; the npm test command is a placeholder.

## Module map

- `public/` presents the POS, order history, customer Khata, and inventory/GST audit views.
- `server.js` serves the UI, mounts the products/orders/customers/reports routers under `/api`, and renders `/orders/:id/invoice`.
- The four files in `routes/` validate/translate HTTP requests and call library functions.
- `lib/orders.js` creates, retrieves, cancels, searches and filters orders.
- `lib/inventory.js` checks sellable stock and changes stock quantities.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` implement checkout totals.
- `lib/invoice.js` independently computes and renders invoice figures.
- `lib/ledger.js` maintains credit billing and settlements.
- `lib/dates.js` supplies display dates, comparison keys and fiscal years.
- `lib/reports.js` produces dashboard and reconciliation results.
- `lib/store.js` persists `data/db.json`; `config.js` supplies settings.

## Placing an order

1. The browser submits product IDs, quantities, customer/payment details and coupon to POST `/api/orders`.
2. The router reads the store and resolves authoritative product details and quantities.
3. Inventory checks the sellable stock: physical stock less reserved units.
4. Coupon validation and pricing calculate discounts, item GST and the total.
5. Khata orders check the customer's credit limit and increase the billed amount.
6. Inventory deducts physical quantities; the order module adds the order.
7. The router appends an audit event, writes the JSON store, and returns the order.
8. Invoice rendering and reconciliation later calculate invoice figures separately.

## Confirmed Ticket 3 causes

- Order sorting compares DD/MM/YYYY strings instead of chronological keys.
- Date filtering converts the browser's ISO input into DD/MM/YYYY and compares those strings.
- Settlement amounts arrive from the browser as strings and are added without numeric conversion, producing concatenation.
- The fiscal-year helper also calls the normalization function and must retain its behavior if the key format changes.

## Confirmed risks

The store has synchronous whole-file writes and no transaction or concurrency mechanism. Configuration includes an embedded administrative key. The invoice calculation duplicates checkout logic. HTTP handlers and the original data file must not be used by automated tests without isolation.

## I suspect

The application has additional robustness and security issues beyond the three workshop tickets. No vulnerability audit or dependency-version assessment has been performed, so specific security claims would require further evidence. Those investigations are outside this Ticket 3 repair.
