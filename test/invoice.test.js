'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Pure module calls only: no server, store, filesystem fixtures, or database access.
function item(overrides = {}) {
  return { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1, ...overrides };
}

function order(items, coupon = '', overrides = {}) {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id: 1001, date: '15/11/2026', customer: 'Test Customer',
    items, coupon, subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total, ...overrides
  };
}

function amounts(figures) {
  const { subtotal, discount, tax, cgst, sgst, total } = figures;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: SAVE10 on 5% HSN goods matches the billed total and GST', () => {
  const o = order([item({ price: 1020 })], 'SAVE10');
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
});

test('REGRESSION: capped SAVE10 on groundnut oil matches the ticket and does not mutate the order', () => {
  const o = order([item({ price: 2240, hsn: '1508' })], 'SAVE10');
  const before = structuredClone(o);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5
  });
  invoice.render(o);
  assert.deepEqual(o, before);
});

test('REGRESSION: mixed slabs receive proportional coupon discounts in invoice GST rows', () => {
  const figures = invoice.computeInvoiceFigures(order([
    item({ price: 200 }), item({ id: 2, price: 200, hsn: '0405' }),
    item({ id: 3, price: 200, hsn: '0902' })
  ], 'SAVE10'));
  assert.deepEqual(amounts(figures), {
    subtotal: 600, discount: 60, tax: 63, cgst: 31.5, sgst: 31.5, total: 603
  });
  assert.deepEqual(figures.rows.map(r => r.lineTax), [9, 21.6, 32.4]);
});

test('REGRESSION: invoice uses mixed HSN slabs', () => {
  const o = order([item(), item({ id: 2, name: 'Ghee', hsn: '0405' }),
    item({ id: 3, name: 'Tea', hsn: '0902' })]);
  assert.equal(o.tax, 35);
  assert.equal(o.total, 335);
  const figures = invoice.computeInvoiceFigures(o);
  assert.deepEqual(amounts(figures), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(figures.rows.map(r => [r.hsn, r.gstPercent, r.lineTax]),
    [['1006', 5, 5], ['0405', 12, 12], ['0902', 18, 18]]);
});

test('CURRENT BEHAVIOUR: unknown HSN without a coupon agrees with fallback billing', () => {
  const o = order([item({ hsn: 'UNKNOWN' })]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  assert.equal(o.total, 118);
});

for (const [gstRate, billedTax, invoiceTax, displayedPercent] of [
  [5, 5, 5, 5], [0.05, 5, 5, 5], [0, 0, 0, 0]
]) {
  test(`REGRESSION: gstRate ${gstRate} produces invoice tax ${invoiceTax} and label ${displayedPercent}%`, () => {
    const o = order([item({ gstRate })]);
    const figures = invoice.computeInvoiceFigures(o);
    assert.equal(o.tax, billedTax);
    assert.equal(figures.tax, invoiceTax);
    assert.equal(figures.total, 100 + invoiceTax);
    assert.equal(figures.rows[0].gstPercent, displayedPercent);
  });
}

test('REGRESSION: percent discount reduces the taxable value before GST', () => {
  const o = order([item({ price: 1000, gstRate: 18 })], 'SAVE10');
  assert.deepEqual([o.discount, o.tax, o.total], [100, 162, 1062]);
  const figures = invoice.computeInvoiceFigures(o);
  assert.deepEqual(amounts(figures), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
  assert.equal(figures.rows[0].lineTax, 162);
});

test('REGRESSION: invoice respects percent coupon maximum discount', () => {
  const o = order([item({ price: 2000, gstRate: 18 })], 'SAVE10');
  assert.deepEqual([o.discount, o.tax, o.total], [150, 333, 2183]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
});

test('REGRESSION: flat coupon reduces taxable value', () => {
  const o = order([item({ price: 300, gstRate: 18 })], 'FLAT50');
  assert.deepEqual([o.discount, o.tax, o.total], [50, 45, 295]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 300, discount: 50, tax: 45, cgst: 22.5, sgst: 22.5, total: 295
  });
});

test('REGRESSION: invoice ignores expired coupons and coupons below minimum subtotal', () => {
  for (const [coupon, discount, total] of [['DIWALI20', 0, 118], ['SAVE10', 0, 118]]) {
    const o = order([item({ gstRate: 18 })], coupon);
    assert.deepEqual([o.discount, o.total], [0, 118]);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
      subtotal: 100, discount, tax: 18, cgst: 9, sgst: 9, total
    });
  }
});

test('REGRESSION: ineligible flat coupon cannot make a small invoice total negative', () => {
  const figures = invoice.computeInvoiceFigures(order([item({ price: 10 })], 'FLAT50'));
  assert.deepEqual(amounts(figures), {
    subtotal: 10, discount: 0, tax: 0.5, cgst: 0.25, sgst: 0.25, total: 10.5
  });
});

test('REGRESSION: invoice normalizes coupons and ignores unknown codes', () => {
  for (const coupon of ['save10', ' SAVE10 ', 'UNKNOWN']) {
    const o = order([item({ price: 1000, gstRate: 18 })], coupon);
    assert.equal(invoice.computeInvoiceFigures(o).discount, coupon === 'UNKNOWN' ? 0 : 100);
    assert.equal(invoice.computeInvoiceFigures(o).total, coupon === 'UNKNOWN' ? 1180 : 1062);
  }
});

test('REGRESSION: invoice sums rounded line taxes like billing', () => {
  const o = order([item({ price: 0.03, gstRate: 18 }), item({ id: 2, price: 0.03, gstRate: 18 })]);
  const figures = invoice.computeInvoiceFigures(o);
  assert.deepEqual([o.tax, o.total], [0.02, 0.08]);
  assert.deepEqual(figures.rows.map(r => r.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(figures), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
});

test('CURRENT BEHAVIOUR: stored monetary totals are ignored when computing invoice figures', () => {
  const o = order([item({ gstRate: 18 })], '', {
    subtotal: 900, discount: 800, tax: 700, total: 600
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(o)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('CURRENT BEHAVIOUR: missing items yields zero figures and no rows', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('CURRENT BEHAVIOUR: invoice rows expose gross amounts and placeholder SKU and HSN', () => {
  const figures = invoice.computeInvoiceFigures({ items: [{ name: 'Loose goods', price: 25, qty: 2 }] });
  assert.deepEqual(figures.rows, [{
    name: 'Loose goods', sku: '-', hsn: '-', qty: 2, price: 25,
    gstPercent: 18, line: 50, lineTax: 9
  }]);
});

test('REGRESSION: rendered invoice matches HSN billing and retains signed notices for genuine differences', () => {
  const o = order([item()]);
  const html = invoice.render(o);
  assert.ok(html.includes('<td class="r">5%</td>'));
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹5.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹105.00</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(invoice.render({ ...o, total: 100 }).includes('by +₹5.00.'));
  assert.ok(invoice.render({ ...o, total: 120 }).includes('by -₹15.00.'));
});

test('REGRESSION: rendered percentage coupon has matching GST and no notice', () => {
  const o = order([item({ price: 1000, gstRate: 18 })], 'SAVE10');
  assert.equal(o.total, 1062);
  assert.equal(o.tax, 162);
  const html = invoice.render(o);
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹162.00</td>'));
  assert.ok(html.includes('-₹100.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});
