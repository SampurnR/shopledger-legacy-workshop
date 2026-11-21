'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function orderFromLedger(id, items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  return {
    id,
    date: '21/11/2026',
    customer: 'In-memory characterization customer',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice matches checkout for Order #1002 with SAVE10', () => {
  const items = [
    { id: 1, name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ];
  const order = orderFromLedger(1002, items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 1020);
  assert.equal(order.discount, 102);
  assert.equal(order.tax, 45.9);
  assert.equal(order.total, 963.9);
  assert.deepEqual(
    [figures.discount, figures.tax, figures.total],
    [order.discount, order.tax, order.total]
  );
  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 5]);
  assert.equal(figures.cgst + figures.sgst, order.tax);

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the SAVE10 maximum discount for Order #1004', () => {
  const items = [
    { id: 5, name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ];
  const order = orderFromLedger(1004, items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 104.5);
  assert.equal(order.total, 2194.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice uses mixed HSN rates for non-coupon Orders #1001 and #1007', () => {
  const order1001 = orderFromLedger(1001, [
    { id: 8, name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 2 },
    { id: 2, name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2 }
  ], '');
  const order1007 = orderFromLedger(1007, [
    { id: 6, name: 'A2 Gir Cow Ghee 500ml', sku: 'DRY-001', hsn: '0405', price: 450, qty: 2 },
    { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ], '');

  [order1001, order1007].forEach((order) => {
    const figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.tax, order.tax);
    assert.equal(figures.total, order.total);
  });
  assert.deepEqual(invoice.computeInvoiceFigures(order1001).rows.map((row) => row.gstPercent), [18, 5]);
  assert.deepEqual(invoice.computeInvoiceFigures(order1007).rows.map((row) => row.gstPercent), [12, 5]);
});

test('invoice remains matched for all-18% no-coupon Order #1008', () => {
  const order = orderFromLedger(1008, [
    { id: 8, name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 },
    { id: 12, name: 'Kokum Sherbet Concentrate 750ml', sku: 'BEV-003', hsn: '2106', price: 180, qty: 2 }
  ], '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 90);
  assert.equal(order.total, 590);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation matches all ticket orders to their bills', () => {
  const orders = [
    orderFromLedger(1002, [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ], 'SAVE10'),
    orderFromLedger(1004, [
      { id: 5, name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
    ], 'SAVE10')
  ];
  const result = reports.getGstReconciliation({ orders });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.ok(result.rows.every((row) => row.matched));
  assert.equal(result.totalDelta, 0);
});
