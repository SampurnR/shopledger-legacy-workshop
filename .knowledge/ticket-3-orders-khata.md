# Ticket 3: Order dates and Khata settlements

## Ask and acceptance criteria

Order history must sort newest calendar dates first, and HTML date filters must include only orders inside the requested range. Khata settlement amounts sent by the browser must update balances arithmetically; invalid amounts must be rejected without mutating ledger data.

## Investigation and root cause

`lib/orders.js` relied on `lib/dates.js` to turn ISO filter values back into `DD/MM/YYYY`, then compared and sorted those display strings lexically. Day-first strings do not preserve calendar order.

`routes/customers.js` passes JSON values to `lib/ledger.js`. The ledger added the unnormalized value directly to `totalSettled`, so a string such as `"500"` caused concatenation and a non-numeric string could produce a `NaN` balance.

Characterization tests first pinned the incorrect sort and filter results, ISO normalization, string concatenation, and invalid settlement mutation. All fixtures are in memory.

## Plan and rejected approaches

- Locale-dependent `Date` parsing was rejected because it can introduce timezone shifts and accepts ambiguous or rolled-over dates.
- Coercing only in the route was rejected because direct and future ledger callers would remain unsafe.
- Reformatting stored dates was rejected because it would require a data migration outside this ticket.

The selected design parses the two supported formats strictly, validates calendar days, and produces a canonical `YYYY-MM-DD` comparison key. Settlement values are converted and validated at the ledger boundary before any mutation.

## Result and verification

Production changes are confined to `lib/dates.js`, `lib/orders.js`, and `lib/ledger.js`. Comments document the comparison-key and mutation-boundary invariants.

- Five correct-behaviour assertions failed before the fix; all seven Ticket 3 tests pass after it.
- `node --test test/*.test.js` passes all 24 tests.
- A disposable Express copy returned orders `1008` through `1001`, limited February–March to `1008` through `1005`, accepted `"500"` as a numeric settlement, and rejected `"abc"` with HTTP 400 without further mutation.
- Tests and runtime checks do not use the repository's `data/db.json`; its checksum is unchanged.

## Remaining limitation and changelog

Only the repository's existing `DD/MM/YYYY` storage format and HTML `YYYY-MM-DD` input format are accepted. Invalid legacy dates remain visible at the end of an unfiltered order list and are excluded when a valid date filter is active.

User-visible change: order history and date ranges are chronological, while Khata settlement strings can no longer concatenate into or corrupt customer balances.
