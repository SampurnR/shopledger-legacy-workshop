# CP4: Ticket 2 reproduction, fix, and review

## Ticket and scope

[Issue #2](https://github.com/SampurnR/shopledger-legacy-workshop/issues/2):
cannot sell the last sellable unit and cancelling orders never restores stock.
Only `lib/inventory.js` changes application behavior.

## Reproduction in running temporary project copies

The before and after copies each contain their own `lib/`, `routes/`, `public/`,
`config.js`, `server.js`, and `data/db.json`. Existing installed dependencies were
resolved with `NODE_PATH`, without changing package manifests. The copies ran on
local ports 3101 and 3102, respectively. The original app was not used for mutations.

Browser automation interacted with the real quantity inputs, Place Order button,
Order History Cancel button, and Inventory Audit tab. These are browser screenshots
of running app states, not mockups.

| Scenario | Before | After |
| --- | --- | --- |
| Ghee: physical 1, reserved 0, buy 1 | HTTP 409, out of stock | HTTP 201; stock 0, reserved 0 |
| Chilli: physical 4, reserved 3, buy 1 | Exact sellable quantity rejected by the same check | HTTP 201; stock 3, reserved 3, sellable 0 |
| Cancel pending #1007, ghee quantity 2 | CANCELLED, stock stays 1 | CANCELLED, stock 1 to 3 |
| Cancel pending #1007, oil quantity 2 | Stock stays 22, reserved 4 | Stock 22 to 24, reserved remains 4 |

Ghee and chilli checkout screenshots were recorded before resetting only the
temporary after-copy database to reproduce #1007 cancellation from a fresh seed.
The unit tests independently verify repeat cancellation and zero remaining sellable stock.

### Browser evidence

- [Before last-unit checkout](evidence/cp4-before-last-unit.png)
- [After last-unit checkout](evidence/cp4-after-last-unit.png)
- [After selling the last unreserved chilli packet](evidence/cp4-after-reserved-unit.png)
- [Inventory after broken cancellation](evidence/cp4-before-cancellation.png)
- [Inventory after corrected cancellation](evidence/cp4-after-cancellation.png)
- [Recorded observations](evidence/browser-observations.json)

## Red, then green

1. Commit `162dc3f` adds 21 passing characterization tests before any application change.
2. Commit `84b4966` adds seven regression cases. `node --test` exits 1:
   **22 passed, 6 failed**. See [the original failing output](evidence/cp4-red.txt).
3. Change the inventory module and explicitly update the four old-behavior tests
   listed in [CP3](03-characterization-tests.md).
4. `node --test` exits 0: **28 passed, 0 failed**.
   See [the original passing output](evidence/cp4-green.txt).

## Root cause and smallest fix

- `check()` used `qty >= sellable`, rejecting equality. It now rejects only `qty > sellable`.
  `getSellableStock()` still subtracts wholesale reservations before comparison.
- `release()` looked up `productId`, but stored order lines use `id`. It now resolves `id`.
- Checkout `reserve()` deducts physical `stock`; `release()` incorrectly reduced `reserved`.
  Release now adds numeric quantities back to numeric physical stock and leaves holds alone.

No router, order, ledger, pricing, invoice, configuration, or frontend behavior was changed.

## Manual code review

Review method: inspected the full diff and all callers, checked boundary and error
cases, ran the regression suite, and reproduced the selected ticket through the UI.
This is a documented manual review, not a claim that the `/review` command ran.

The `@codex review` request on PR #8 received an account/integration setup notice
instead of a code review. The workshop explicitly allows the manual review as a
fallback, so no automated review success is claimed.

Findings for this diff: **no blocking findings**.

- `orders.cancel()` is the only application caller of `inventory.release()` and
  passes the stored `id` line shape. Its existing cancelled-status guard runs before
  release and khata reversal, preventing a second restoration.
- Exact-stock orders leave physical stock equal to reserved stock. Another positive
  purchase is rejected; tests cover zero stock and fully reserved products.
- Unknown products retain the existing check/release behavior. Stock check is read-only.
- Numeric quantity strings are converted when restoring stock, avoiding concatenation.
- Khata reversal, settlement totals, reason/date metadata, and completed cash-order
  cancellation retain their baseline tests.
- Unit tests do not load the database or start servers and use no new dependencies.
- Other application modules and `package.json` are unchanged. `package-lock.json`
  remains local and uncommitted.

Remaining pre-existing risks include duplicate cart lines bypassing aggregate stock
validation, arbitrary order statuses from API callers, invoice inconsistencies, date
comparison, settlement coercion, authentication, and whole-file persistence. These
are outside this ticket and are not silently fixed or claimed as resolved.

## Original database integrity

SHA-256 before and after reproduction/tests:

```text
378042acaef84300a04a1b6ea043a3e279ed0969d76dc1f9deffd91d095ceb49
```

The original `data/db.json` is byte-for-byte unchanged. All mutations occurred in
temporary copies outside the repository. The PR must not contain seed data or a lockfile.
