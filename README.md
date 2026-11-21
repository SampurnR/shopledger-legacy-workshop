# ShopLedger | Invoice integrity

**Seven mismatched invoices. One shared calculation path. Zero changed ledger records.**

Workshop submission for [ticket #1](https://github.com/SampurnR/shopledger-legacy-workshop/issues/1).
This exercise fixes printable invoice figures so they agree with the existing
checkout/ledger rules. Only `lib/invoice.js` changes among production modules.

**[Open pull request #269](https://github.com/SampurnR/shopledger-legacy-workshop/pull/269)**
· **[Downloadable submission reports](docs/submission/)**
· **[Passing Node 22/24 CI](https://github.com/maazmohammed112/shopledger-legacy-workshop/actions/runs/44898016503)**

The reports are designed document exports. The submission guide identifies
genuine UI screenshots that still need to be captured manually.

| Verified result | Before | After |
| --- | ---: | ---: |
| Sample invoices with amount/GST mismatch | 7 of 8 | 0 of 8 |
| Sum of absolute invoice amount differences | INR 612.01 | INR 0.00 |
| #1002 invoice total | INR 1083.24 | INR 963.90 |
| #1002 invoice GST | INR 183.60 | INR 45.90 |
| #1004 SAVE10 discount | INR 264.32 | INR 150.00 |

The fixed invoice shows gross amount, apportioned discount, taxable value,
line GST and separate CGST/SGST totals. Genuine ledger discrepancies still
produce a reconciliation warning; the fix does not hide them.

## Run and test

Requirements: Node.js 22+ with npm, and Git.

```sh
npm install --no-package-lock
node --test
npm start
```

Open http://localhost:3000. This is a workshop app with a legacy keyed export
endpoint and no user authentication. Keep it local.

`npm test` remains the legacy placeholder; the workshop's real command is
`node --test`. No dependencies were added. Do not commit a generated lockfile.

## Evidence and checkpoint history

1. [CP1: read-only exploration](docs/checkpoint-1-explanation.md)
2. [CP2: architecture](docs/architecture.svg)
3. [AGENTS.md](AGENTS.md), created before testing
4. CP3: `c9b2b3b` records 28 passing characterization/contract tests before fixes.
5. CP4 red: `8ee542a` records correct-behaviour regressions; 20 of 22 failed.
6. CP4 green: `df541ae` fixes the invoice and adds isolated HTTP coverage.
7. [QA and review](docs/verification.md), [actual run logs](docs/evidence/)

The current suite has **65 tests**, including **15 HTTP tests** and a single
deterministic test that exercises **336 cart combinations**. Those combinations
are not counted as 336 separate tests. Independent golden amounts verify the
rules in addition to the shared-engine parity matrix.

```sh
node --test --experimental-test-coverage --test-coverage-include=lib/invoice.js
```

Measured on Node v24.19.0: invoice line/function coverage 100%, branch coverage
95.24%. Coverage applies to the selected module, not the entire application.

## Safe before/after demonstration

```sh
node scripts/demo.js before 3001
node scripts/demo.js after 3002
```

Each command makes a fresh temporary project copy and runs that copy. The
`before` copy comes from baseline `68c85a9`; the `after` copy uses current source.
Original `data/db.json` is not used as the demo server's working database.
Stop a demo with Ctrl+C. Then:

- Open each URL and choose **Inventory & GST Audit**.
- Compare seven mismatches with all eight balanced.
- Open `/orders/1002/invoice` on both ports to inspect tax and total changes.
- The original data file's SHA-256 is recorded in the verification report.

## Architecture

![ShopLedger architecture and order flow](docs/architecture.svg)

## Learn the agent workflow

[Agent workflow guide](docs/agent-workflow.md) explains role boundaries, handoffs,
how to avoid a self-confirming test oracle, and how the test-first commits prove
the sequence. These were sequential roles performed in one Codex session, not a
claim of separate independent agents or reviews.

## Scope and limits

- The inventory and date/Khata tickets are intentionally left for later work.
- No original orders, customer balances or source database records were changed.
- Historical invoices still depend on the current coupon/tax configuration;
  immutable pricing snapshots would require a separate design change.
- Shared checkout rounding is preserved, including its per-line allocation rules.
- Browser access was blocked by a saved permission setting. HTTP/HTML checks
  passed, but actual browser layout, mobile and print QA still need visual
  confirmation. Exported reports do not impersonate browser/Codex screenshots.
