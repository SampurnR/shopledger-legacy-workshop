# ShopLedger legacy workshop

An Express and plain JavaScript POS, inventory, khata credit, and GST invoicing app.
This submission implements **Ticket 2: last-unit sales and cancellation stock restoration**.

## Run

Requires Node.js 22 or newer. Install the existing dependencies with `npm install`,
then run `npm start` and open <http://localhost:3000>.
In PowerShell where `npm.ps1` is blocked, use `npm.cmd install` and `npm.cmd start`.
Do not commit the generated `package-lock.json`.

## Test

```sh
node --test
```

There are 28 tests across three files in `test/`. They use built-in Node modules
and fresh in-memory fixtures, with no dependency additions and no reads or writes
to `data/db.json`. `npm test` remains the legacy placeholder.

## Ticket 2 behavior

- An order may buy exactly `stock - reserved` units. Larger quantities are rejected.
- Cancelling an order restores the deducted physical units using the order line's
  `id`, without changing wholesale reserved holds.
- The existing cancellation guard prevents returning stock or credit twice.
- Application behavior changes are confined to `lib/inventory.js`.

## Workshop checkpoints

- [CP1: read-only analysis](docs/01-read-only-analysis.md)
- [CP2: architecture diagram](docs/architecture.svg)
- [CP3: characterization tests and history](docs/03-characterization-tests.md)
- [CP4: reproduction, fix, and manual review](docs/04-fix-and-review.md)
- [Submission form answers and evidence map](docs/submission.md)
- [Standing agent instructions](AGENTS.md)
- [Uploadable AGENTS.md PDF](output/pdf/AGENTS.pdf)

The characterization-only commit passed 21 tests before any behavior change. The
next commit added regressions: 22 passed and 6 failed. The fix brings all 28 green.
The exact command output and browser screenshots are in `docs/evidence/`.

## Data safety and scope

App interactions write to a tracked JSON file. All browser reproduction for this
submission used temporary project copies with separate database files. The source
database was preserved byte for byte and is excluded from the PR changes.

Invoice/GST reconciliation, date filtering, settlement coercion, and other risks
described in CP1 remain separate tickets. The smaller inventory fix does not resolve
those known issues.
