# Ticket 1: Invoice total and GST breakdown

## Ask and acceptance criteria

Printed invoices must match the amounts recorded at checkout. The reported failures covered 5% and 12% HSN items, percentage coupons, the `SAVE10` ₹150 cap, and GST reconciliation. An all-18%, no-coupon order was the known matching control.

Completion requires:

- invoice subtotal, discount, GST, CGST, SGST, total, rate labels, and line GST to agree with billing;
- stored historical order figures to remain authoritative;
- reconciliation to stop flagging correctly billed orders;
- tests to use in-memory orders and never `data/db.json`.

## Investigation and root cause

Checkout uses `lib/pricing.js`, which apportions capped coupon discounts before tax and resolves item rates through `lib/tax.js`. `lib/invoice.js` had a separate calculation: missing `gstRate` values fell back to 18%, and percentage coupons were applied to subtotal plus tax without the configured cap. This duplicated policy and caused the two paths to drift.

Characterization tests first pinned the observed ₹640 discounted 5% item, the ignored discount cap, a non-coupon 12% item taxed at 18%, the reconciliation mismatch, and the all-18% control.

## Plan and rejected approaches

- Reimplementing corrected tax and coupon rules inside the invoice was rejected because it would preserve two policy engines.
- Recomputing every historical invoice from current configuration was rejected because stored order totals are the actual billed record.
- Copying only stored aggregate totals was rejected because line GST could still disagree with the invoice total.

The selected design reuses `pricing.computeTotals()` for line proportions and HSN labels, uses valid stored order figures for billed aggregates, and assigns rounding remainder to the final line so line GST sums exactly to stored GST.

## Result

`lib/invoice.js` now shares checkout pricing semantics and preserves billed history. Comments document the stored-value invariant and GST apportionment rule. Characterization expectations were updated to the corrected behaviour, with additional coverage for the exact coupon cap, 12% HSN, mixed rates, historical figures, rendering, and reconciliation.

Verification:

- Correct-behaviour regression failed against the characterization commit with invoice GST ₹115.20 and total ₹679.68 versus billed GST ₹28.80 and total ₹604.80.
- `node --test test/*.test.js` passes 10 tests.
- The running-app flow was previously reproduced through a disposable project copy, keeping the repository data file unchanged.
- Final review found no unresolved Ticket 1 defect.

## Remaining limitation and changelog

Historical orders do not store original per-line tax breakdowns. When stored aggregate GST differs from a current recomputation, the invoice preserves the billed aggregate and apportions it across lines using current HSN proportions.

User-visible change: printed invoice totals and GST breakdowns now follow checkout billing and stored order totals.
