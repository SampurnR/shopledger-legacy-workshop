'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice uses the billed HSN slab and matches the billed coupon totals', function () {
  var items = [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.subtotal, 640);
  assert.equal(billed.discount, 64);
  assert.equal(billed.tax, 28.8);
  assert.equal(billed.total, 604.8);

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].discount, 64);
  assert.equal(printed.rows[0].taxable, 576);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);

  var html = invoice.render({ items: items, coupon: 'SAVE10', total: billed.total });
  assert.ok(html.includes('<th class="r">Discount</th><th class="r">Taxable</th>'));
  assert.ok(html.includes('<td class="r"><strong>₹640.00</strong></td><td class="r">-₹64.00</td><td class="r">₹576.00</td><td class="r">5%</td><td class="r">₹28.80</td>'));
});

test('invoice calculates flat-coupon GST on the same discounted value as billing', function () {
  var items = [
    { id: 2, sku: 'DRY-002', name: 'Butter', hsn: '0405', price: 400, qty: 1, gstRate: 12 }
  ];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 42);
  assert.equal(billed.total, 392);

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].discount, 50);
  assert.equal(printed.rows[0].taxable, 350);
});

test('invoice percentage coupon uses the billed subtotal base and maximum discount', function () {
  var items = [
    { id: 3, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 3000, qty: 1, gstRate: 5 }
  ];
  var billed = pricing.computeTotals(items, 'WHOLESALE15');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WHOLESALE15' });

  assert.equal(billed.discount, 400);
  assert.equal(billed.tax, 130);
  assert.equal(billed.total, 2730);

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].discount, 400);
  assert.equal(printed.rows[0].taxable, 2600);
});

test('invoice line discounts and taxable amounts reconcile after rounding', function () {
  var items = [
    { id: 4, sku: 'GRN-001', name: 'Rice A', hsn: '1006', price: 100, qty: 1 },
    { id: 5, sku: 'GRN-002', name: 'Rice B', hsn: '1006', price: 100, qty: 1 },
    { id: 6, sku: 'GRN-003', name: 'Rice C', hsn: '1006', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });
  var lineDiscount = printed.rows.reduce(function (sum, line) { return sum + line.discount; }, 0);
  var lineTaxable = printed.rows.reduce(function (sum, line) { return sum + line.taxable; }, 0);
  var lineTax = printed.rows.reduce(function (sum, line) { return sum + line.lineTax; }, 0);

  assert.equal(lineDiscount, billed.discount);
  assert.equal(lineTaxable, billed.subtotal - billed.discount);
  assert.equal(lineTax, billed.tax);
});
