'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');

var items = [
  { id: 1, name: 'Rice', sku: 'GRA-001', hsn: '1006', price: 100, qty: 2 },
  { id: 2, name: 'Ghee', sku: 'DRY-001', hsn: '0405', price: 450, qty: 1 }
];

test('CURRENT BEHAVIOUR: billed pricing applies coupon discount before each HSN GST slab', function () {
  assert.equal(coupons.normalizeCode(' welcome '), 'WELCOME');
  assert.equal(coupons.validate('welcome', 650).discount, 32.5);

  var totals = pricing.computeTotals(items, 'WELCOME');
  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    lineRates: totals.lines.map(function (line) { return line.gstPercent; })
  }, {
    subtotal: 650,
    discount: 32.5,
    tax: 60.8,
    cgst: 30.4,
    sgst: 30.4,
    total: 678.3,
    lineRates: [5, 12]
  });
});

test('CURRENT BEHAVIOUR: invoice totals match the amount recorded by order pricing', function () {
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(billed.total, 678.3);
  assert.equal(invoiced.total, billed.total);
  assert.equal(invoiced.tax, billed.tax);
});
