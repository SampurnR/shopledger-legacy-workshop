# Workshop evidence and current calculation flow

## CP2 diagrams: PRE-FIX checkpoint baseline

`architecture.svg` and `architecture.png` are preserved, unchanged CP2 evidence from before the Issue #1 fix. Their independent invoice-calculation relationship describes that baseline, not the current implementation.

Current flow: `server.js` invoice endpoint calls `invoice.render()`, which calls `invoice.computeInvoiceFigures()`. That function now calls `pricing.computeTotals()`. Pricing delegates discount rules to `coupons.js` and GST resolution/splitting to `tax.js`; these use `config.js`. Invoice rows reuse pricing's per-line gross amounts, GST rates and post-discount taxes. No separate current diagram is needed for this focused change.

## Characterization tests updated in GREEN

Six original bug-recording tests changed: percentage discount ordering (GST 50 to 45 and discount 105 to 100); flat-coupon minimum spend (discount 50 to 0); representative #1002 and #1004 invoice figures (now equal verified checkout figures); non-coupon HSN rates (18% to the respective 5%/12%); and reconciliation (two mismatches to zero). Their names/comments were updated accordingly. Four unaffected tests and the nine original RED-phase regression tests were preserved.

## Existing limitations retained

- Historical invoices recalculate using current GST/coupon configuration. Future configuration changes may change historical invoice figures. Persisting calculation snapshots is outside this ticket.
- Checkout rounds each proportional line discount independently. For three 0.10 lines with WELCOME, the cart discount is 0.02 but line discounts total 0.03. Invoice intentionally follows existing checkout rounding; allocation changes are outside this ticket.
- `npm test` remains a placeholder; use `node --test`. Keep the generated `package-lock.json` out of the eventual PR through explicit staging. Nothing is staged automatically.
