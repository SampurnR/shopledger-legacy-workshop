'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');

test('invoice uses HSN based billed GST when order lines omit gstRate', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const charged = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(charged.tax, 5);
  assert.equal(charged.total, 105);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice figures match the billed GST breakdown and total for stored HSN order lines', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const charged = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total
  }, {
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    cgst: charged.cgst,
    sgst: charged.sgst,
    total: charged.total
  });
});

test('CURRENT BEHAVIOUR: invoice uses an explicit gstRate as a percentage', function () {
  const printed = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }],
    coupon: ''
  });

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.equal(printed.total, 105);
});

test('invoice uses the same capped coupon and post-discount GST as the billed order', function () {
  const items = [{ id: 1, name: 'Staples', hsn: '1006', price: 3000, qty: 1 }];
  const charged = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(charged.discount, 100);
  assert.equal(charged.tax, 145);
  assert.equal(charged.total, 3045);
  assert.equal(printed.discount, charged.discount);
  assert.equal(printed.tax, charged.tax);
  assert.equal(printed.total, charged.total);
});

test('invoice ignores a flat coupon below the billing minimum', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const validation = require('../lib/coupons').validate('FLAT50', pricing.subtotal(items));
  const charged = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.equal(validation.valid, false);
  assert.equal(charged.discount, 0);
  assert.equal(printed.discount, 0);
  assert.equal(printed.total, charged.total);
});

test('invoice HTML shows the billed CGST and SGST amounts separately', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const charged = pricing.computeTotals(items, '');
  const html = invoice.render({
    id: 1,
    date: '01/01/2021',
    items: items,
    coupon: '',
    total: charged.total
  });

  assert.equal(charged.cgst, 2.5);
  assert.equal(charged.sgst, 2.5);
  assert.match(html, /<td>CGST<\/td><td class="r">2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">2\.50<\/td>/);
});

test('CURRENT BEHAVIOUR: tax split rounds CGST first and assigns the remainder to SGST', function () {
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});

test('CURRENT BEHAVIOUR: pricing resolves the configured HSN slab and falls back to the default for unknown HSN', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '9999' }), 0.18);
  assert.equal(tax.getRateForItem({}), 0.18);
});

test('CURRENT BEHAVIOUR: pricing accepts GST rates as either fractions or percentages', function () {
  assert.equal(tax.getRateForItem({ gstRate: 0.05, hsn: '9999' }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 5, hsn: '9999' }), 0.05);
});

test('CURRENT BEHAVIOUR: pricing rounds the aggregate subtotal to two decimal places', function () {
  assert.equal(pricing.subtotal([{ price: 1.005, qty: 1 }]), 1.01);
});

test('CURRENT BEHAVIOUR: pricing apportions a capped coupon by line gross and computes GST on discounted line amounts', function () {
  const totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 300, qty: 1 },
    { id: 2, name: 'Spices', hsn: '0904', price: 300, qty: 1 }
  ], 'SAVE10');

  assert.equal(totals.subtotal, 600);
  assert.equal(totals.discount, 60);
  assert.deepEqual(totals.lines.map(function (line) {
    return { discount: line.discount, taxable: line.taxable, tax: line.tax };
  }), [
    { discount: 30, taxable: 270, tax: 13.5 },
    { discount: 30, taxable: 270, tax: 32.4 }
  ]);
  assert.equal(totals.tax, 45.9);
  assert.equal(totals.total, 585.9);
});

test('CURRENT BEHAVIOUR: pricing rounds GST on each line before adding the order tax', function () {
  const totals = pricing.computeTotals([
    { hsn: '1006', price: 0.1, qty: 1 },
    { hsn: '1006', price: 0.1, qty: 1 }
  ], '');

  assert.deepEqual(totals.lines.map(function (line) { return line.tax; }), [0.01, 0.01]);
  assert.equal(totals.tax, 0.02);
  assert.equal(totals.cgst, 0.01);
  assert.equal(totals.sgst, 0.01);
});

test('invoice handles a fractional gstRate like the billing tax module', function () {
  const printed = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }],
    coupon: ''
  });

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice normalizes coupon codes and ignores inactive coupons like billing', function () {
  const items = [{ name: 'Groceries', hsn: '1006', price: 100, qty: 1 }];
  const lowerCase = invoice.computeInvoiceFigures({ items: items, coupon: 'welcome' });
  const inactive = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(lowerCase.discount, 5);
  assert.equal(lowerCase.tax, 4.75);
  assert.equal(lowerCase.total, 99.75);
  assert.equal(inactive.discount, 0);
  assert.equal(inactive.total, 105);
  assert.equal(coupons.validate('DIWALI20', 100).valid, false);
});

test('invoice rounds line GST consistently with billed totals', function () {
  const printed = invoice.computeInvoiceFigures({
    items: [
      { name: 'One', gstRate: 5, price: 0.1, qty: 1 },
      { name: 'Two', gstRate: 5, price: 0.1, qty: 1 }
    ],
    coupon: ''
  });

  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
  assert.equal(printed.total, 0.22);
});

test('CURRENT BEHAVIOUR: invoice defaults missing order fields to an empty item list and no discount', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0,
    discount: 0,
    tax: 0,
    cgst: 0,
    sgst: 0,
    total: 0,
    rows: []
  });
});

test('CURRENT BEHAVIOUR: invoice render shows a reconciliation warning only when its recomputed total differs from stored order total', function () {
  const order = {
    id: 7,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 5 }],
    coupon: '',
    total: 105
  };
  const matchingHtml = invoice.render(order);
  const mismatchingHtml = invoice.render(Object.assign({}, order, { total: 104 }));

  assert.doesNotMatch(matchingHtml, /Accountant Reconciliation Notice/);
  assert.match(mismatchingHtml, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice HTML escapes ampersands and angle brackets in item names', function () {
  const html = invoice.render({
    id: 1,
    items: [{ name: '<Rice & Dal>', hsn: '1006', price: 100, qty: 1 }],
    coupon: ''
  });

  assert.match(html, /&lt;Rice &amp; Dal&gt;/);
  assert.doesNotMatch(html, /<Rice & Dal>/);
});
