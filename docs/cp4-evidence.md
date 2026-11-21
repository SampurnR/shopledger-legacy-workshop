# CP4 — Ticket 1 reproduce, fail, fix and review

## Reproduction before the fix

Command: `node docs/reproduce-ticket1.cjs before`.
The helper copied the app, configuration and data to a newly created OS temporary
directory, started that copied server on an ephemeral loopback port, fetched the
GST report and all eight invoice pages, and placed a new SAVE10 order. Only copied
data was loaded by the server. Dependencies came from existing node_modules through
NODE_PATH; nothing was installed. The server was stopped and the copy retained.

Actual HTTP evidence: docs/evidence/cp4-before-http.json.
Actual HTTP invoice response: docs/evidence/cp4-before-invoice-1002.html.
Before: 8 checked, 7 mismatches, total absolute delta 612.01.

| Order | Before invoice discount / GST / total | Billed discount / GST / total |
| --- | --- | --- |
| 1001 | 0 / 109.80 / 719.80 | 0 / 66.90 / 676.90 |
| 1002 | 120.36 / 183.60 / 1083.24 | 102 / 45.90 / 963.90 |
| 1003 | 50 / 72 / 422 | 50 / 49.35 / 399.35 |
| 1004 | 264.32 / 403.20 / 2378.88 | 150 / 104.50 / 2194.50 |
| 1005 | 50 / 180 / 1130 | 50 / 91.96 / 1041.96 |
| 1006 | 71.39 / 217.80 / 1356.41 | 60.50 / 155.61 / 1305.11 |
| 1007 | 0 / 230.40 / 1510.40 | 0 / 127 / 1407 |
| 1008 control | 0 / 90 / 590 | 0 / 90 / 590 |

## Failing correct-behavior test before the fix

Added test/invoice-correctness.test.js before production changes.
Command: `node --test --test-reporter=spec test/invoice-correctness.test.js`.
Actual complete output: docs/cp4-failing-test-output.txt; exit 1, 13 tests failed.
#1002 expected discount 102 but received 120.36; #1004 expected 150 but received
264.32; #1001 expected GST 66.90 but received 109.80.
The extended #1008 regression fails because the old result lacks taxable fields,
not because its original total was mismatched. CP3 proves that control passed.

## Minimal production change and updated characterization tests

Only lib/invoice.js changed in production: computeInvoiceFigures now delegates to
pricing.computeTotals and maps its line figures into invoice rows. It exposes
line discount/taxable and aggregate taxable values and converts price to Number
for the renderer's existing toFixed call. The HTML template, checkout, routes,
tax, coupons, persistence and other tickets are unchanged.

Only the seven bug cases #1001–#1007 in invoice-characterization.test.js changed
expectations: explicit corrected totals and resolved HSN rates. Their titles keep
CORRECTED from CURRENT BEHAVIOUR. originalFigures retains the old baseline.
The #1008 control and checkout authority expectations did not change.
Original passing evidence is preserved in cp3-test-output.txt.

## App behavior after the fix

Command: `node docs/reproduce-ticket1.cjs after`, using a fresh temporary copy.
Actual evidence: docs/evidence/cp4-after-http.json and
docs/evidence/cp4-after-invoice-1002.html.
All 8 orders match: mismatch count 0, total delta 0. All 8 invoice routes returned
200 without mismatch notices. #1002 now shows discount 102, GST 45.90, total 963.90.
#1004 respects the 150 cap; #1008 stays at 590. Newly placed #1009 returned 201,
discount 102, tax 45.90, total 963.90 and a matching invoice.
Temporary app processes were stopped; temporary project copies were retained.

## Manual review

/review is not callable in this tool session; a manual review was performed.
Commands: git diff --check; git diff --stat; git diff -- lib/invoice.js;
git diff --exit-code HEAD -- data/db.json; git diff --cached --name-only;
Get-FileHash data/db.json,package-lock.json; git status --short; node --test.
Reviewed added tests, fixtures, reproduction helper and evidence documentation.

- Inputs: empty items, numeric prices/strings, normalized/unknown/expired coupons.
- Boundaries: SAVE10 minimum/cap, FLAT50 minimum, WELCOME/WHOLESALE15 caps,
  zero/decimal/percentage GST, unknown HSN fallback and mixed 5/12/18% items.
- Rounding: shared per-line rounding and CGST/SGST remainder preserved.
- Side effects: unit tests use only in-memory fixtures, load no store and access
  no data file. The HTTP helper mutates only copied data. Inputs remain unchanged.
- Errors: no new swallowed errors; stale recorded totals still flag mismatches.
- Scope: only invoice.js changed in production; no dependencies added.
- No blocking review findings. Historical recalculation still uses current coupon
  and tax configuration; policy snapshots are a separate future task. Existing
  pricing can allocate line discounts with a cent residual; this fix follows
  billed pricing rather than changing its policy.

## Data safety and Git

Tracked data/db.json matches HEAD and initial SHA256:
378042ACAEF84300A04A1B6EA043A3E279ED0969D76DC1F9DEFFD91D095CEB49.
Pre-existing untracked package-lock.json is unchanged, SHA256:
5EDCFA05E7C1312A22A9F9CF16F4DCDAF31602584D063338A1F7F1237308F08F.
Neither is staged. No commit, push, PR, public repo creation or GitHub access.
The pre-existing PDF is untouched.

## Full passing test output

Command: `node --test` (exit 0). 22 assertion tests plus one fixture module
discovered by Node = 23 passing entries, zero failures.
Raw output: docs/cp4-passing-test-output.txt.

```text
✔ test\fixtures\invoice-orders.js (181.676ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1001 complete figures (10.5186ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1002 complete figures (1.5587ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1003 complete figures (1.3042ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1004 complete figures (0.8164ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1005 complete figures (0.9592ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1006 complete figures (1.0967ms)
✔ CORRECTED from CURRENT BEHAVIOUR: invoice #1007 complete figures (0.7775ms)
✔ Matching control: invoice #1008 complete figures (0.9455ms)
✔ Checkout authority applies SAVE10 subtotal discount and cap before HSN GST (1.7296ms)
✔ CORRECT BEHAVIOUR: invoice #1001 agrees with customer billing (10.0965ms)
✔ CORRECT BEHAVIOUR: invoice #1002 agrees with customer billing (2.7044ms)
✔ CORRECT BEHAVIOUR: invoice #1003 agrees with customer billing (1.9592ms)
✔ CORRECT BEHAVIOUR: invoice #1004 agrees with customer billing (1.6917ms)
✔ CORRECT BEHAVIOUR: invoice #1005 agrees with customer billing (3.0724ms)
✔ CORRECT BEHAVIOUR: invoice #1006 agrees with customer billing (2.0973ms)
✔ CORRECT BEHAVIOUR: invoice #1007 agrees with customer billing (1.4832ms)
✔ CORRECT BEHAVIOUR: invoice #1008 agrees with customer billing (2.1531ms)
✔ Reconciliation matches all eight in-memory orders; flags stale recorded totals (2.7513ms)
✔ Rendering retains metadata and removes notice only when totals match (2.4152ms)
✔ Coupon eligibility, normalization and all discount caps follow checkout (3.4522ms)
✔ Explicit percent/decimal/zero GST, HSN fallback, empty orders and numeric strings (4.2823ms)
✔ Rounding and input immutability match checkout on fractional mixed-slab lines (1.6479ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 542.6492
```
