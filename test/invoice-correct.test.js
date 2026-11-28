// Tests for the CORRECT behaviour expected for the ticket:
// "Invoice total and GST breakdown do not match what the customer was billed."
//
// Expected: the accountant invoice (lib/invoice.js) must agree with the order
// ledger figures produced by lib/pricing.js for the same order.

var test = require('node:test');
var assert = require('node:assert');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('CORRECT BEHAVIOUR: invoice GST breakdown and total match the ledger billed total for a coupon order', function () {
  var items = [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ];

  var totals = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1009,
    date: '28/11/2026',
    customer: 'Kalyani Foods (Wholesale)',
    coupon: 'SAVE10',
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };

  var inv = invoice.computeInvoiceFigures(order);

  assert.strictEqual(inv.subtotal, 2240);
  assert.strictEqual(inv.discount, 150);
  assert.strictEqual(inv.tax, 104.5);
  assert.strictEqual(inv.cgst, 52.25);
  assert.strictEqual(inv.sgst, 52.25);
  assert.strictEqual(inv.total, 2194.5);
  assert.strictEqual(inv.rows[0].gstPercent, 5);
});

test('CORRECT BEHAVIOUR: invoice applies the HSN slab GST rate when no coupon is present', function () {
  var order = {
    id: 1010,
    date: '28/11/2026',
    customer: 'Walk-in',
    coupon: '',
    items: [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 2 }
    ]
  };

  var inv = invoice.computeInvoiceFigures(order);

  assert.strictEqual(inv.subtotal, 1280);
  assert.strictEqual(inv.discount, 0);
  assert.strictEqual(inv.tax, 64);
  assert.strictEqual(inv.cgst, 32);
  assert.strictEqual(inv.sgst, 32);
  assert.strictEqual(inv.total, 1344);
  assert.strictEqual(inv.rows[0].gstPercent, 5);
});
