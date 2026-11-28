# Invoice characterization tests

Run `node --test` from the repository root (validated with Node.js 22.23.5).
Expected result: 30 passing tests, no failures or skipped tests. No dependencies
or package scripts were changed; `npm test` remains the existing placeholder.

These tests cover the invoice fix and preserve unrelated existing behavior. Tests
labelled `CURRENT BEHAVIOUR` still deliberately assert discrepancies. Expected money
values are literal examples rather than results calculated by another copy of
the implementation.

`invoice-characterization.test.js` exercises pricing, tax, coupons, stored order
fields, invoice calculations/HTML, and reconciliation. `billing-flow.test.js`
invokes the real preview, order, and invoice handlers directly, without HTTP
sockets. It covers khata charging and invalid coupons as well as successful
billing. It does not test Express middleware or browser interaction.

All products, customers, and orders are synthetic objects in memory. The route
tests install throwing guards over store reads/writes before loading the app,
then replace those guards with per-test in-memory implementations. The suite
never reads or writes `data/db.json`. Temporary configuration changes are
restored after the test.

Reproducible focused checks:

- `node --test --test-name-pattern="khata billing"`: expect the stored order
  and khata charge to be 472.50, GST to be 22.50, and the rendered invoice to show
  472.50 with GST of 22.50 and no warning.
- `node --test --test-name-pattern="tax-only mismatch"`: a deliberately stale
  stored tax of 90.00 versus invoice tax of 81.00 still causes a reconciliation
  mismatch and no invoice warning when both totals are 531.00.
- `node --test --test-name-pattern="invalid coupon"`: expect previews to return
  undiscounted totals and validation errors, while order handlers return 400
  without saving an order or changing stock.
- `node --test --test-name-pattern="rounded line taxes|rounding"`: invoice tax
  now sums rounded line taxes like billing; existing discount allocation
  differences between line nets and cart totals remain observable.

Cancellation appears only as an excluded reconciliation record; unrelated
inventory cancellation and date filtering behavior is outside this ticket.

## Reproduction and regression

The real Express app was started on an ephemeral localhost port from a temporary
project copy, with a synthetic database (the original database was not copied).
POST `/api/orders` with one 500.00 item, HSN `1006`, quantity 1 and coupon
`SAVE10`, then GET `/orders/1/invoice`.

Before the fix: HTTP 201, billed total 472.50 and GST 22.50, invoice total 531.00
and GST 90.00, reconciliation warning present. The new
`invoice-regression.test.js` failed with those actual values against the expected
472.50 / 22.50. After the fix, the same live HTTP check returned invoice total
472.50 and GST 22.50 with no warning. Both temporary servers were closed.
The original `data/db.json` SHA-256 remained unchanged.

## Updated characterization coverage

- Mixed HSN invoice test: expects 5%, 12%, 18% and discounted line tax.
- Five GST representation cases: invoice now follows billing's interpretation.
- Seven coupon cases: invoice now follows normalization, minimum spend, active
  status, caps and pre-tax discounts.
- Line tax rounding: invoice now sums rounded line taxes.
- Current-configuration test: updated discount/tax values; recalculation remains.
- Tax-only reconciliation and absolute-delta tests: deliberately inconsistent
  stored figures retain warning/report coverage after the calculation fix.
- Preview/khata flow: invoice now matches the stored order and customer charge.

Unchanged limitations remain characterized: historical invoices recalculate with
current configuration, routes drop product GST overrides, preview permits
fractional quantities that orders truncate, and line discount allocation can
leave a rounding remainder. Only `lib/invoice.js` production code changed.
