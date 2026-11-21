const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const orders = require('./fixtures/invoice-orders');

for (const order of orders) {
  test('CORRECT BEHAVIOUR: invoice #' + order.id + ' agrees with customer billing', () => {
    const figures = invoice.computeInvoiceFigures(order);
    for (const key of ['subtotal', 'discount', 'tax', 'total']) assert.equal(figures[key], order[key], key);
    assert.equal(pricing.round2(figures.cgst + figures.sgst), figures.tax);
    const billed = pricing.computeTotals(order.items, order.coupon);
    assert.equal(figures.taxable, billed.taxable);
    figures.rows.forEach((row, i) => {
      assert.equal(row.gstPercent, billed.lines[i].gstPercent);
      assert.equal(row.lineTax, billed.lines[i].tax);
      assert.equal(row.taxable, billed.lines[i].taxable);
      assert.equal(row.discount, billed.lines[i].discount);
      assert.equal(row.line, billed.lines[i].gross);
    });
  });
}

test('Reconciliation matches all eight in-memory orders; flags stale recorded totals', () => {
  assert.equal(reports.getGstReconciliation({ orders }).mismatchCount, 0);
  assert.equal(reports.getGstReconciliation({ orders: [{ ...orders[7], total: 1 }] }).mismatchCount, 1);
});

test('Rendering retains metadata and removes notice only when totals match', () => {
  const order = { ...orders[1], customer: '<Fixture & customer>', date: '05/01/2022' };
  const html = invoice.render(order);
  assert.match(html, /963\.90/);
  assert.match(html, /45\.90/);
  assert.match(html, /&lt;Fixture &amp; customer&gt;/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(invoice.render({ ...order, total: 1 }), /Accountant Reconciliation Notice:/);
});

test('Coupon eligibility, normalization and all discount caps follow checkout', () => {
  for (const [price, coupon, discount] of [
    [499, 'SAVE10', 0], [500, ' save10 ', 50], [1500, 'SAVE10', 150],
    [2240, 'SAVE10', 150], [299, 'FLAT50', 0], [300, 'FLAT50', 50],
    [100, 'UNKNOWN', 0], [1000, 'DIWALI20', 0], [3000, 'WELCOME', 100],
    [4000, 'WHOLESALE15', 400]
  ]) {
    const figures = invoice.computeInvoiceFigures({ items: [{ price, qty: 1, hsn: '1006' }], coupon });
    assert.equal(figures.discount, discount, coupon + ' on ' + price);
    assert.equal(figures.tax, pricing.round2((price - discount) * 0.05));
    assert.equal(figures.total, pricing.round2(price - discount + figures.tax));
  }
});

test('Explicit percent/decimal/zero GST, HSN fallback, empty orders and numeric strings', () => {
  for (const [metadata, rate] of [
    [{ gstRate: 5, hsn: '0902' }, 5], [{ gstRate: 0.12 }, 12],
    [{ gstRate: 0, hsn: '0902' }, 0], [{ hsn: '0405' }, 12], [{ hsn: 'unknown' }, 18]
  ]) {
    const figures = invoice.computeInvoiceFigures({ items: [{ name: 'Sample', price: '10.10', qty: '3', ...metadata }] });
    assert.equal(figures.rows[0].gstPercent, rate);
    assert.equal(figures.tax, pricing.round2(30.3 * rate / 100));
    assert.equal(pricing.round2(figures.cgst + figures.sgst), figures.tax);
  }
  const empty = invoice.computeInvoiceFigures({});
  for (const key of ['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total']) assert.equal(empty[key], 0);
  assert.deepEqual(empty.rows, []);
});

test('Rounding and input immutability match checkout on fractional mixed-slab lines', () => {
  const order = { coupon: 'WELCOME', items: [
    { price: 13.37, qty: 3, hsn: '1006' }, { price: 17.19, qty: 2, hsn: '0405' },
    { price: 9.99, qty: 1, hsn: '0902' }
  ] };
  const snapshot = JSON.stringify(order);
  const figures = invoice.computeInvoiceFigures(order);
  const billed = pricing.computeTotals(order.items, order.coupon);
  for (const key of ['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total']) assert.equal(figures[key], billed[key]);
  assert.equal(JSON.stringify(order), snapshot);
});
