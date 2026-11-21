var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

// In-memory copies of the relevant order lines; tests never load the JSON store.
function makeOrder(id, items, coupon, billed) {
  return {
    id: id,
    date: '2022-01-01',
    customer: 'Test Customer',
    items: items,
    coupon: coupon || '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

var orders = {
  mixedSave10: makeOrder(1002, [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 4, sku: 'OIL-001', name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10', { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }),
  cappedSave10: makeOrder(1004, [
    { id: 5, sku: 'OIL-002', name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10', { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }),
  mixedNoCoupon: makeOrder(1001, [
    { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 2 },
    { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 165, qty: 2 }
  ], '', { subtotal: 610, discount: 0, tax: 66.9, total: 676.9 }),
  all18NoCoupon: makeOrder(1008, [
    { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 1 },
    { id: 12, sku: 'BEV-003', name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
  ], '', { subtotal: 500, discount: 0, tax: 90, total: 590 })
};

test('invoice matches checkout for mixed-rate SAVE10 order #1002', function () {
  var figures = invoice.computeInvoiceFigures(orders.mixedSave10);
  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 });
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
  var checkout = pricing.computeTotals(orders.mixedSave10.items, 'SAVE10');
  assert.deepEqual([figures.subtotal, figures.discount, figures.tax, figures.total],
    [checkout.subtotal, checkout.discount, checkout.tax, checkout.total]);
});

test('invoice applies the SAVE10 discount cap for order #1004', function () {
  var figures = invoice.computeInvoiceFigures(orders.cappedSave10);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice resolves 18% and 5% HSN slabs on order #1001', function () {
  var figures = invoice.computeInvoiceFigures(orders.mixedNoCoupon);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [50.4, 16.5]);
  assert.equal(figures.tax, 66.9);
  assert.equal(figures.total, 676.9);
});

test('invoice totals for all 18% HSN order #1008 match checkout', function () {
  var figures = invoice.computeInvoiceFigures(orders.all18NoCoupon);
  assert.equal(figures.tax, 90);
  assert.equal(figures.total, 590);
});

test('printed invoice displays gross line values alongside post-discount GST', function () {
  var html = invoice.render(orders.mixedSave10);
  assert.match(html, /Gross Subtotal[\s\S]*?1020\.00/);
  assert.match(html, /GST Amt[\s\S]*?28\.80/);
  assert.match(html, /Line Gross[\s\S]*?640\.00/);
  assert.match(html, /Coupon Discount \(SAVE10\)[\s\S]*?102\.00/);
  assert.match(html, /Invoice Total[\s\S]*?963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
