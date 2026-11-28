var test = require('node:test').test;
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

function order(data) {
  return Object.assign({ items: [], coupon: '' }, data);
}

test('invoice for order 1002 matches the billed SAVE10 total and GST breakdown', function () {
  var result = invoice.computeInvoiceFigures(order({
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.90,
    total: 963.90,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  }));

  assert.equal(result.tax, 45.90);
  assert.equal(result.cgst, 22.95);
  assert.equal(result.sgst, 22.95);
  assert.equal(result.discount, 102);
  assert.equal(result.total, 963.90);
  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.rows[0].discount, 64);
  assert.equal(result.rows[0].lineTax, 28.80);
  assert.equal(result.rows[1].gstPercent, 5);
  assert.equal(result.rows[1].discount, 38);
  assert.equal(result.rows[1].lineTax, 17.10);
});

test('invoice for order 1004 applies the SAVE10 cap and 5% HSN slab', function () {
  var result = invoice.computeInvoiceFigures(order({
    id: 1004,
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.50,
    total: 2194.50,
    items: [
      { id: 5, sku: 'OIL-002', name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }
    ]
  }));

  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.tax, 104.50);
  assert.equal(result.cgst, 52.25);
  assert.equal(result.sgst, 52.25);
  assert.equal(result.discount, 150);
  assert.equal(result.total, 2194.50);
});

test('invoice uses HSN slabs on an undiscounted mixed-rate order', function () {
  var result = invoice.computeInvoiceFigures(order({
    subtotal: 610,
    discount: 0,
    tax: 66.90,
    total: 676.90,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 140, qty: 2 },
      { id: 2, sku: 'GRN-002', name: 'Dal', hsn: '0713', price: 165, qty: 2 }
    ]
  }));

  assert.equal(result.rows[0].gstPercent, 18);
  assert.equal(result.rows[1].gstPercent, 5);
  assert.equal(result.tax, 66.90);
  assert.equal(result.cgst + result.sgst, result.tax);
  assert.equal(result.total, 676.90);
});

test('invoice recalculates from line items instead of stored order totals', function () {
  var result = invoice.computeInvoiceFigures(order({
    subtotal: 999,
    discount: 123,
    tax: 456,
    total: 1332,
    items: [
      { id: 9, sku: 'TEST-001', name: 'Rice', hsn: '1006', price: 10, qty: 1 }
    ]
  }));

  assert.equal(result.subtotal, 10);
  assert.equal(result.discount, 0);
  assert.equal(result.tax, 0.5);
  assert.equal(result.total, 10.5);
});
