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

test('CURRENT BEHAVIOUR: Order #1002 taxes 5% HSN items at 18% default rate and discounts tax', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1002);
  // Current buggy calculation in unfixed code:
  // Subtotal = 640 + 380 = 1020
  // Tax = 1020 * 0.18 = 183.60 (ignoring 5% HSN slab 1006 & 1512)
  // Discount = (1020 + 183.60) * 10% = 120.36 (discounting subtotal + tax!)
  // Total = 1020 + 183.60 - 120.36 = 1083.24
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.tax, 183.60);
  assert.equal(figures.discount, 120.36);
  assert.equal(figures.total, 1083.24);
});

test('CURRENT BEHAVIOUR: Order #1004 ignores maxDiscount cap of 150 on SAVE10 and taxes at 18%', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1004);
  // Current buggy calculation in unfixed code:
  // Subtotal = 2240
  // Tax = 2240 * 0.18 = 403.20 (ignoring 5% HSN 1508)
  // Discount = (2240 + 403.20) * 10% = 264.32 (ignores maxDiscount: 150 cap)
  // Total = 2240 + 403.20 - 264.32 = 2378.88
  assert.equal(figures.subtotal, 2240);
  assert.equal(figures.tax, 403.20);
  assert.equal(figures.discount, 264.32);
  assert.equal(figures.total, 2378.88);
});

test('CURRENT BEHAVIOUR: Order #1001 taxes non-coupon 5% HSN items at default 18%', function () {
  var figures = invoice.computeInvoiceFigures(mockOrder1001);
  // Current buggy calculation in unfixed code:
  // Subtotal = 280 + 330 = 610
  // Both items taxed at 18% = 109.80 (instead of 280*18% + 330*5% = 66.90)
  // Total = 719.80
  assert.equal(figures.subtotal, 610);
  assert.equal(figures.tax, 109.80);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 719.80);
});

test('render produces HTML document with invoice title and breakdown', function () {
  var html = invoice.render(mockOrder1008);
  assert.ok(html.includes('Tax Invoice #1008'));
  assert.ok(html.includes('INV-1008'));
  assert.ok(html.includes('Assam CTC Masala Chai 250g'));
});
