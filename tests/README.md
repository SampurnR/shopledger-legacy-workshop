Run the characterization and regression suite with `node --test` from the repository root.
It uses Node's built-in test runner and requires the application's installed dependencies.

The tests pin existing billing, coupon, GST, rounding, invoice rendering,
reconciliation, and khata behavior. Tests named `CURRENT BEHAVIOUR` deliberately
assert discrepancies; they describe the current implementation, not desired rules.

All products, customers, and orders are synthetic in-memory objects. HTTP tests
replace `store.read` and `store.write` with test-scoped mocks before requests,
and use an ephemeral loopback server. They never read or write `data/db.json`.
The invoice fix reuses billing's calculator in `lib/invoice.js`; package scripts
are unchanged. `invoice-regression.test.js` was run before the fix and failed
with invoice total 1062 and GST 180 instead of total 945 and GST 45.

Updated old characterization cases in `billing.test.js`: HSN resolution;
decimal and zero GST overrides; percent discount GST breakdown; coupon cap;
flat discount taxable value; expired/below-minimum coupons; coupon normalization;
and per-line GST rounding. The reconciliation and mismatch-banner tests now
use deliberately inconsistent stored amounts so they still exercise genuine
mismatches. The tax-only banner limitation remains `CURRENT BEHAVIOUR`.

In `billing-flow.test.js`, updated the preview/khata/invoice/reconciliation case
to expect agreement, plus the cancelled invoice's displayed amount. Unrelated
characterization cases (HSN prefix lookup, discount allocation rounding,
cancellation stock, invalid preview coupons and fractional quantities) remain.
