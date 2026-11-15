'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function makeOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    customer: 'In-memory characterization customer',
    coupon: coupon || '',
    items: items.map((item) => ({ ...item })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: invoice GST and total match billed HSN-based figures', () => {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);

  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.deepEqual(
    { tax: printed.tax, total: printed.total },
    { tax: 5, total: 105 }
  );
});

test('CURRENT BEHAVIOUR: mixed HSN slabs stay per-line and match billed totals on invoice', () => {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 100, qty: 1 }
  ]);

  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map((line) => [line.gstPercent, line.tax]), [[5, 5], [12, 12]]);
  assert.deepEqual(printed.rows.map((row) => [row.gstPercent, row.lineTax]), [[5, 5], [12, 12]]);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.total, 217);
});

test('CURRENT BEHAVIOUR: coupon discount and GST in invoice match the billed pre-tax discount calculation', () => {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }
  ], 'SAVE10');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 640, discount: 64, tax: 28.8, total: 604.8 }
  );
});

test('CURRENT BEHAVIOUR: invoice HTML shows billed GST and total without a mismatch notice', () => {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);

  const html = invoice.render(order);

  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, />5%<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

