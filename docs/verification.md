# Verification and self-review

Selected issue: SampurnR/shopledger-legacy-workshop#1  
Environment: Windows, Node v24.19.0, npm 11.17.0  
Source baseline: `68c85a9`  
Review method: direct diff inspection and test execution within this Codex
session. This is a manual self-review, not `/review` or independent approval.

## Test-first record

| Stage | Command | Observed result |
| --- | --- | --- |
| CP3, before source fix (`c9b2b3b`) | `node --test --test-reporter=tap` | 28 passed, 0 failed |
| CP4 red (`8ee542a`) | `node --test --test-reporter=tap tests/invoice.regression.test.js` | 2 passed, 20 failed |
| First green, before HTTP additions | `node --test --test-reporter=tap` | 50 passed, 0 failed |
| Full QA | `node --test --test-reporter=tap` | 65 passed, 0 failed |
| Coverage | `node --test --experimental-test-coverage --test-coverage-include=lib/invoice.js --test-reporter=tap` | 65 passed; selected-module line/functions 100%, branches 95.24% |

Raw, unedited outputs are stored under [evidence/](evidence/). Test files are
`tests/invoice.characterization.test.js`, `tests/pricing.contract.test.js`,
`tests/invoice.regression.test.js` and `tests/invoice.http.test.js`.

## Independent sample reconciliation

| Order | Old invoice total | Recorded ledger / fixed invoice | Fixed GST |
| --- | ---: | ---: | ---: |
| #1001 | 719.80 | 676.90 | 66.90 |
| #1002 | 1083.24 | 963.90 | 45.90 |
| #1003 | 422.00 | 399.35 | 49.35 |
| #1004 | 2378.88 | 2194.50 | 104.50 |
| #1005 | 1130.00 | 1041.96 | 91.96 |
| #1006 | 1356.41 | 1305.11 | 155.61 |
| #1007 | 1510.40 | 1407.00 | 127.00 |
| #1008 | 590.00 | 590.00 | 90.00 |

All monetary amounts are INR. Total absolute amount variance falls from 612.01
to 0.00. Existing ledger revenue remains 8578.72. No ledger rewrite is performed.

## What was checked

- Golden saved amounts for every sample order, plus independently specified
  mixed-slab GST, discount caps, minimum spend, expiry, normalization, decimal and
  zero tax overrides and fractional-paise rounding examples.
- One deterministic matrix covering 336 slab/price/coupon/quantity combinations.
- Fifteen HTTP tests through the real Express app: invoice HTML, audit,
  dashboard, preview, create -> print -> audit, invalid input, missing orders,
  stock rejection, escaped metadata, genuine mismatches and static assets.
- Tests use an authored fixture copy and an in-memory store. Original store
  read/write functions are guarded to throw. No tests read `data/db.json`.
- `git diff --check` passes. No dependency manifests or original UI files change.
- Installation of existing dependencies reported zero vulnerabilities at that
  moment. This is not a security certification or a replacement for an audit.

## Intentional characterization updates

- Seven CURRENT BEHAVIOUR figure snapshots (#1001-#1007) now expect the recorded
  ledger amounts. #1008's figures remain unchanged.
- Reconciliation expectation changes from seven mismatches to zero.
- The row shape assertion includes the new `discount` and `taxable` fields;
  existing row fields and public exports remain available.
- Original assertions and passing output remain available in `c9b2b3b`.

## Data integrity

Original `data/db.json` SHA-256, before and after testing:

```
378042ACAEF84300A04A1B6EA043A3E279ED0969D76DC1F9DEFFD91D095CEB49
```

The source file remains byte-for-byte unchanged. The demo servers run in separate
temporary project copies and may change only their own copied data.

## Review findings and remaining work

No blocking issue was identified in the scoped production diff by this
self-review. Existing pricing logic is reused without changing its rules;
invoice output still warns when the recorded total actually disagrees.

Browser access was rejected by a saved permission setting, including after the
user approved a retry. Therefore browser layout, narrow-screen and print checks
were not completed, and before/after app screenshots remain a manual step. HTTP
and HTML assertions do not establish visual correctness.

Historical configuration drift, per-line discount allocation residuals, store
concurrency, broader browser injection risks and the other two workshop tickets
remain separate concerns. No claim of production readiness is made.
