# Ticket 2: Sellable stock and cancellation restoration

## Ask and acceptance criteria

The last sellable unit of a product must be purchasable even when other physical units are reserved for wholesale quotes. Cancelling Pending Order #1007 must return its committed quantities to physical stock without releasing unrelated reservations. A repeated cancellation must not restore stock twice.

## Investigation and root cause

`routes/orders.js` checks stock, calls `inventory.reserve()`, and stores order lines with an `id` field. Despite its name, `reserve()` subtracts committed quantities from physical `stock`.

Two independent defects existed in `lib/inventory.js`:

- `check()` rejected `qty >= sellable`, so an order equal to the remaining sellable quantity failed.
- `release()` looked for `productId` while current order lines use `id`, then reduced `reserved` instead of reversing the physical-stock deduction.

Characterization tests first pinned both one-unit examples from the ticket, the unchanged stock after cancelling Order #1007, the working Khata reversal, the physical deduction performed by `reserve()`, and cancellation idempotency.

## Plan and rejected approaches

- Changing only `>=` to `>` was rejected because duplicate lines for one SKU could then pass separately and overdraw stock.
- Reducing `reserved` during cancellation was rejected because wholesale holds are independent of committed order stock.
- Changing the order item schema was rejected because it would expand the ticket into routing and stored-data migration.

The selected design aggregates requested quantities by product during validation, allows the aggregate to equal sellable stock, and makes `release()` add quantities back to physical stock. It accepts current `id` and legacy `productId` line shapes. Existing order-level cancellation guards prevent a second restoration.

## Result and verification

Production changes are confined to `lib/inventory.js`. Comments document the equality, duplicate-line, and reservation invariants.

- Correct-behaviour tests failed before the fix for both last-unit cases, duplicate lines, cancellation restoration, and legacy items.
- `node --test test/*.test.js` passes 17 tests after the fix.
- Tests use in-memory data only; `data/db.json` is unchanged.

## Remaining limitation and changelog

Cancellation still skips an order line whose product no longer exists in the catalog, matching existing tolerant behaviour.

User-visible change: the final sellable unit can be sold, and cancelling an order restores its deducted physical stock while retaining wholesale reservations.
