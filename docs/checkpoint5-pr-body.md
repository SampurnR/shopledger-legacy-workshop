Fixes #<issue-number>

Tests added first: `test/invoice.test.js` characterizes invoice totals and correct behavior for capped coupons, HSN GST, and persisted checkout figures.

Cause: invoice code recalculated coupon discounts against tax-inclusive totals, omitted the coupon cap, defaulted missing `gstRate` to 18%, and ignored totals recorded during checkout.

Fix: use the existing HSN tax resolver and the persisted checkout subtotal, discount, tax, and total in `lib/invoice.js`.

Test result: `node --test` — 3 passed, 0 failed. `git diff --check` passed.
