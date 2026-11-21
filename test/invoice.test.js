var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

// In-memory test fixtures - NEVER touch data/db.json
var mockOrder1002 = {
  id: 1002,
  date: '05/01/2022',
  customer: 'Anil Kulkarni',
  paymentMode: 'upi',
  coupon: 'SAVE10',
  total: 963.90,
  tax: 45.90,
  items: [
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ]
};

var mockOrder1004 = {
  id: 1004,
  date: '30/01/2022',
  customer: 'Kalyani Foods (Wholesale)',
  paymentMode: 'khata',
  coupon: 'SAVE10',
  total: 2194.50,
  tax: 104.50,
  items: [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ]
};

var mockOrder1001 = {
  id: 1001,
  date: '28/12/2021',
  customer: 'Meera Joshi',
  paymentMode: 'khata',
  coupon: '',
  total: 676.90,
  tax: 66.90,
  items: [
    { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
    { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
  ]
};

var mockOrder1008 = {
  id: 1008,
  date: '15/03/2022',
  customer: 'Walk-in',
  paymentMode: 'cash',
  coupon: '',
  total: 590.00,
  tax: 90.00,
  items: [
    { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
    { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
  ]
};

test('Order #1008: matches when all items are 18% HSN and no coupon applied', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1008);
  assert.equal(figures.subtotal, 500);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 90);
  assert.equal(figures.total, 590);
  assert.equal(figures.cgst, 45);
  assert.equal(figures.sgst, 45);
});

test('FIX VERIFIED: Order #1002 correctly resolves 5% HSN rate and applies SAVE10 discount proportionally', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1002);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.90);
  assert.equal(figures.total, 963.90);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
});

test('FIX VERIFIED: Order #1004 respects maxDiscount cap of 150 on SAVE10 and 5% HSN slab', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1004);
  assert.equal(figures.subtotal, 2240);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.50);
  assert.equal(figures.total, 2194.50);
  assert.equal(figures.cgst, 52.25);
  assert.equal(figures.sgst, 52.25);
});

test('FIX VERIFIED: Order #1001 correctly applies item-specific HSN rates (18% and 5%) without coupon', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1001);
  assert.equal(figures.subtotal, 610);
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 66.90);
  assert.equal(figures.total, 676.90);
  assert.equal(figures.cgst, 33.45);
  assert.equal(figures.sgst, 33.45);
});

test('render produces HTML document without reconciliation warning when figures match', function () {
  var html = invoice.render(mockOrder1002);
  assert.ok(html.includes('Tax Invoice #1002'));
  assert.ok(html.includes('INV-1002'));
  assert.ok(html.includes('Indrayani Basmati Rice 5kg'));
  // Reconciliation warning banner should not appear
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
});
