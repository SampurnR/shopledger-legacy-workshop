const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Hand-built fixtures only: no database, store module, server, or filesystem I/O.
function item(overrides = {}) {
  return { id: 1, name: 'Rice', sku: 'TEST-RICE', hsn: '1006', price: 100, qty: 1, ...overrides };
}

function order(items, coupon = '', overrides = {}) {
  return {
    id: 1002, date: '05/01/2022', customer: 'Test customer',
    paymentMode: 'upi', status: 'completed', items, coupon,
    ...overrides
  };
}

function save10Order() {
  return order([
    item({ price: 640 }),
    item({ id: 4, name: 'Oil', sku: 'TEST-OIL', hsn: '1512', price: 190, qty: 2 })
  ], 'SAVE10', { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 });
}

function figures(calc) {
  return {
    subtotal: calc.subtotal, discount: calc.discount, tax: calc.tax,
    cgst: calc.cgst, sgst: calc.sgst, total: calc.total
  };
}

test('checkout baseline: SAVE10 uses discounted 5% HSN values for an order equivalent to #1002', () => {
  const o = save10Order();
  const calc = pricing.computeTotals(o.items, o.coupon);
  assert.deepEqual(figures(calc), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
  assert.deepEqual(calc.lines.map(line => ({ discount: line.discount, taxable: line.taxable, tax: line.tax })), [
    { discount: 64, taxable: 576, tax: 28.8 },
    { discount: 38, taxable: 342, tax: 17.1 }
  ]);
});

test('invoice equivalent to #1002 matches checkout GST and subtotal-based discount', () => {
  const calc = invoice.computeInvoiceFigures(save10Order());
  assert.deepEqual(figures(calc), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
  assert.deepEqual(calc.rows.map(row => ({ rate: row.gstPercent, tax: row.lineTax })), [
    { rate: 5, tax: 28.8 }, { rate: 5, tax: 17.1 }
  ]);
});

test('SAVE10 invoice respects the 150 discount cap on a 2240 subtotal', () => {
  const o = order([item({ price: 2240 })], 'SAVE10');
  assert.deepEqual(figures(pricing.computeTotals(o.items, o.coupon)), {
    subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5
  });
  assert.deepEqual(figures(invoice.computeInvoiceFigures(o)), {
    subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5
  });
});

test('mixed 5%, 12%, and 18% HSN items retain their rates on the invoice', () => {
  const o = order([
    item(), item({ id: 2, name: 'Butter', hsn: '0405' }),
    item({ id: 3, name: 'Tea', hsn: '0902' })
  ]);
  assert.equal(pricing.computeTotals(o.items, '').tax, 35);
  const calc = invoice.computeInvoiceFigures(o);
  assert.equal(calc.tax, 35);
  assert.equal(calc.total, 335);
  assert.deepEqual(calc.rows.map(row => row.gstPercent), [5, 12, 18]);
});

test('flat discount reduces the invoice GST taxable base', () => {
  // Explicit 18% isolates discount timing from the separate HSN lookup bug.
  const o = order([item({ hsn: '0902', gstRate: 18, price: 400 })], 'FLAT50');
  assert.deepEqual(figures(invoice.computeInvoiceFigures(o)), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.5, sgst: 31.5, total: 413
  });
  assert.equal(pricing.computeTotals(o.items, o.coupon).tax, 63);
  assert.equal(pricing.computeTotals(o.items, o.coupon).total, 413);
});

test('invoice ignores SAVE10 below its minimum spend', () => {
  const o = order([item()], 'SAVE10');
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 0);
  assert.equal(invoice.computeInvoiceFigures(o).discount, 0);
});

test('invoice ignores the inactive DIWALI20 coupon', () => {
  const o = order([item({ price: 1000 })], 'DIWALI20');
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 0);
  assert.equal(invoice.computeInvoiceFigures(o).discount, 0);
});

test('invoice normalizes whitespace and lowercase coupon codes', () => {
  const o = save10Order();
  o.coupon = ' save10 ';
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 102);
  assert.equal(invoice.computeInvoiceFigures(o).discount, 102);
});

test('invoice preserves an explicit zero GST rate', () => {
  const o = order([item({ gstRate: 0 })]);
  assert.equal(pricing.computeTotals(o.items, '').tax, 0);
  assert.equal(invoice.computeInvoiceFigures(o).tax, 0);
});

test('decimal GST rate 0.05 is interpreted as 5% on the invoice', () => {
  const o = order([item({ gstRate: 0.05 })]);
  assert.equal(pricing.computeTotals(o.items, '').tax, 5);
  const calc = invoice.computeInvoiceFigures(o);
  assert.equal(calc.tax, 5);
  assert.equal(calc.rows[0].gstPercent, 5);
});

test('invoice supports an explicit percentage GST rate', () => {
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order([item({ gstRate: 5 })]))), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
});

test('18% HSN items without coupons match checkout, like order #1008', () => {
  const o = order([item({ hsn: '0902', price: 500 })]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(o)), figures(pricing.computeTotals(o.items, '')));
  assert.equal(invoice.computeInvoiceFigures(o).total, 590);
});

test('unknown HSN uses the configured fallback and an unknown coupon gives no discount', () => {
  const calc = invoice.computeInvoiceFigures(order([item({ hsn: 'UNKNOWN' })], 'NOT-A-COUPON'));
  assert.deepEqual(figures(calc), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('invoice splits odd-paise tax into rounded CGST and the SGST remainder', () => {
  const calc = invoice.computeInvoiceFigures(order([item({ price: 1, gstRate: 5 })]));
  assert.equal(calc.tax, 0.05);
  assert.equal(calc.cgst, 0.03);
  assert.equal(calc.sgst, 0.02);
});

test('rendered #1002 invoice shows the corrected total and coupon without a mismatch', () => {
  const html = invoice.render(save10Order());
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.doesNotMatch(html, /1083\.24/);
  assert.match(html, /963\.90/);
  assert.match(html, /45\.90/);
  assert.match(html, /Coupon Discount \(SAVE10\)/);
});

test('matching invoice omits the reconciliation notice and escapes customer/item text', () => {
  const html = invoice.render(order([
    item({ name: '<script>test</script>', hsn: '0902', price: 500 })
  ], '', { total: 590, customer: '<b>Customer & Co</b>' }));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /&lt;script&gt;test&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;Customer &amp; Co&lt;\/b&gt;/);
});

test('GST audit reports both corrected #1002 and unchanged #1008 as matched', () => {
  const matchedOrder = order([item({ hsn: '0902', price: 500 })], '', {
    id: 1008, subtotal: 500, discount: 0, tax: 90, total: 590
  });
  const calc = reports.getGstReconciliation({ orders: [save10Order(), matchedOrder] });
  assert.equal(calc.totalChecked, 2);
  assert.equal(calc.mismatchCount, 0);
  assert.equal(calc.totalDelta, 0);
  assert.deepEqual(calc.rows.map(row => ({ id: row.orderId, matched: row.matched, delta: row.delta })), [
    { id: 1002, matched: true, delta: 0 },
    { id: 1008, matched: true, delta: 0 }
  ]);
});
