# Invoice characterization

The invoice path (`lib/invoice.js`) uses `lib/pricing.js` to compute figures from order line items, matching the calculation used when the order is created. Pricing gets GST rates from `lib/tax.js` and applies coupon discounts to the subtotal before calculating tax.

The Node tests under `test/` use in-memory order and item objects; they do not load or mutate `data/db.json`. They verify that invoice HSN GST, coupon discount, line tax, CGST/SGST split, and total match the pricing figures stored on orders. The correct-behavior regression test was first run against the old invoice logic and failed because it produced a ₹5.90 discount instead of the ₹5.00 order discount.

Run with `node --test` from the repository root.
