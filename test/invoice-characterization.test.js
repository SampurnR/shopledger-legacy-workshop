'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');
const reports = require('../lib/reports');
const config = require('../config');

// Pure module calls only: no server, store, or persistent database is loaded.
function item(overrides) {
  return Object.assign({ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }, overrides);
}

function billedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  // Same monetary fields and item shape saved by the order creation route.
  return {
    id: 1001, date: '28/11/2026', customer: 'Test customer', status: 'completed',
    items, coupon: coupon || '', subtotal: totals.subtotal,
    discount: totals.discount, tax: totals.tax, total: totals.total
  };
}

function amounts(figures) {
  const { subtotal, discount, tax, cgst, sgst, total } = figures;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: invoice and billing both use mixed HSN slabs', () => {
  const items = [item(), item({ id: 2, name: 'Ghee', hsn: '0405' }), item({ id: 3, name: 'Tea', hsn: '0902' })];
  const billed = pricing.computeTotals(items, '');
  assert.deepEqual(billed, {
    subtotal: 300, discount: 0, taxable: 300, tax: 35, cgst: 17.5, sgst: 17.5, total: 335,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 0, taxable: 100, tax: 5, net: 105 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 100, discount: 0, taxable: 100, tax: 12, net: 112 },
      { id: 3, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }
    ]
  });
  assert.deepEqual(invoice.computeInvoiceFigures(billedOrder(items)), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335,
    rows: items.map((it, i) => ({ name: it.name, sku: it.sku, hsn: it.hsn, qty: 1, price: 100, gstPercent: [5, 12, 18][i], line: 100, lineTax: [5, 12, 18][i] }))
  });
});

test('CURRENT BEHAVIOUR: unknown HSN without a coupon agrees at the default rate', () => {
  const order = billedOrder([item({ hsn: 'unknown', qty: 2 })]);
  assert.equal(order.total, 236);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236
  });
});

test('REGRESSION: invoice applies SAVE10 before GST like billing', () => {
  const items = [item({ price: 500 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5 });
  assert.equal(billed.lines[0].taxable, 450);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'))), {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5
  });
});

test('REGRESSION: invoice apportions flat coupons across mixed slabs like billing', () => {
  const items = [item({ price: 100 }), item({ id: 2, price: 200, hsn: '0405' })];
  const billed = pricing.computeTotals(items, 'FLAT50');
  assert.deepEqual(billed.lines.map(line => [line.discount, line.taxable, line.tax]), [[16.67, 83.33, 4.17], [33.33, 166.67, 20]]);
  assert.deepEqual(amounts(billed), { subtotal: 300, discount: 50, tax: 24.17, cgst: 12.09, sgst: 12.08, total: 274.17 });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billedOrder(items, 'FLAT50'))), {
    subtotal: 300, discount: 50, tax: 24.17, cgst: 12.09, sgst: 12.08, total: 274.17
  });
});

for (const scenario of [
  { name: 'respects coupon minimum subtotal', price: 100, code: 'SAVE10', billedDiscount: 0, billedTotal: 105 },
  { name: 'respects percent coupon maximum discount', price: 2000, code: 'SAVE10', billedDiscount: 150, billedTotal: 1942.5 },
  { name: 'ignores inactive coupons like billing', price: 1000, code: 'DIWALI20', billedDiscount: 0, billedTotal: 1050 },
  { name: 'normalizes coupon case and whitespace', price: 500, code: ' save10 ', billedDiscount: 50, billedTotal: 472.5 },
  { name: 'rejects flat coupons below their minimum', price: 10, code: 'FLAT50', billedDiscount: 0, billedTotal: 10.5 },
  { name: 'ignores an unknown coupon', price: 100, code: 'NO_SUCH_COUPON', billedDiscount: 0, billedTotal: 105 }
]) {
  test('REGRESSION: invoice ' + scenario.name, () => {
    const order = billedOrder([item({ price: scenario.price })], scenario.code);
    assert.equal(order.discount, scenario.billedDiscount);
    assert.equal(order.total, scenario.billedTotal);
    const figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.discount, scenario.billedDiscount);
    assert.equal(figures.total, scenario.billedTotal);
  });
}

test('CURRENT BEHAVIOUR: billing coupon validation rejects minimum and inactive codes, and normalizes input', () => {
  assert.deepEqual(coupons.validate('SAVE10', 100), { valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500' });
  assert.deepEqual(coupons.validate('DIWALI20', 1000), { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.equal(coupons.validate(' save10 ', 500).code, 'SAVE10');
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
});

for (const scenario of [
  { rate: 5, billingRate: 0.05, percent: 5, tax: 5 },
  { rate: 0.05, billingRate: 0.05, percent: 5, tax: 5 },
  { rate: 0, billingRate: 0, percent: 0, tax: 0 },
  { rate: '5', billingRate: 0.12, percent: 12, tax: 12 }
]) {
  test('REGRESSION: gstRate ' + JSON.stringify(scenario.rate) + ' uses the billing interpretation on invoices', () => {
    const line = item({ hsn: '0405', gstRate: scenario.rate });
    assert.equal(tax.getRateForItem(line), scenario.billingRate);
    const figures = invoice.computeInvoiceFigures({ items: [line] });
    assert.equal(figures.rows[0].gstPercent, scenario.percent);
    assert.equal(figures.tax, scenario.tax);
    assert.equal(figures.total, 100 + scenario.tax);
  });
}

test('REGRESSION: invoice rounds each line like billing', () => {
  const items = [item({ price: 0.03, gstRate: 18 }), item({ id: 2, price: 0.03, gstRate: 18 })];
  assert.deepEqual(amounts(pricing.computeTotals(items)), { subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  const figures = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(amounts(figures), { subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: odd-paise GST assigns the extra paisa to CGST', () => {
  const figures = invoice.computeInvoiceFigures({ items: [item({ price: 0.28, gstRate: 18 })] });
  assert.deepEqual(amounts(figures), { subtotal: 0.28, discount: 0, tax: 0.05, cgst: 0.03, sgst: 0.02, total: 0.33 });
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('CURRENT BEHAVIOUR: invoice ignores stored billed amounts and reads current coupon configuration', () => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  Object.assign(order, { subtotal: 999, discount: 999, tax: 999, total: 999 });
  assert.equal(invoice.computeInvoiceFigures(order).total, 472.5);
  const previous = config.coupons.SAVE10;
  try {
    config.coupons.SAVE10 = Object.assign({}, previous, { value: 20 });
    assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
      subtotal: 500, discount: 100, tax: 20, cgst: 10, sgst: 10, total: 420
    });
    assert.equal(order.total, 999);
  } finally {
    config.coupons.SAVE10 = previous;
  }
});

test('CURRENT BEHAVIOUR: missing items yields zero totals and missing SKU/HSN displays dashes', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: [] });
  assert.deepEqual(invoice.computeInvoiceFigures({ items: [] }).rows, []);
  const figures = invoice.computeInvoiceFigures({ items: [{ name: 'Loose goods', price: 10, qty: 2 }] });
  assert.deepEqual(figures.rows, [{ name: 'Loose goods', sku: '-', hsn: '-', price: 10, qty: 2, gstPercent: 18, line: 20, lineTax: 3.6 }]);
});

test('REGRESSION: rendered invoice shows billing amounts and escapes item text', () => {
  const order = billedOrder([item({ name: '<Rice & grain>', sku: '<R&1>', hsn: '<HSN>', price: 500 })], 'SAVE10');
  const html = invoice.render(order);
  assert.ok(html.includes('&lt;Rice &amp; grain&gt;'));
  assert.ok(html.includes('SKU: &lt;R&amp;1&gt;'));
  assert.ok(html.includes('&lt;HSN&gt;'));
  assert.ok(html.includes('<td class="r">18%</td><td class="r">₹81.00</td><td class="r"><strong>₹500.00</strong></td>'));
  assert.ok(html.includes('Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹50.00</td>'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹531.00</td>'));
  assert.equal(html.includes('₹540.00'), false);
});

test('REGRESSION: reconciliation matches the billed invoice and skips cancelled orders', () => {
  const order = billedOrder([item({ price: 500 })], 'SAVE10');
  const result = reports.getGstReconciliation({ orders: [order, Object.assign({}, order, { id: 1002, status: 'cancelled' })] });
  assert.deepEqual(result, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 1001, date: '28/11/2026', customer: 'Test customer', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 22.5, ledgerTotal: 472.5,
      invoiceDiscount: 50, invoiceTax: 22.5, invoiceTotal: 472.5, delta: 0, matched: true }]
  });
});
