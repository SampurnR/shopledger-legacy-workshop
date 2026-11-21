var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// These tests use only literal in-memory orders and items. They never load data/db.json.

test('invoice uses the HSN GST slab used to bill an item when gstRate is absent', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(billed, {
    subtotal: 100,
    discount: 0,
    taxable: 100,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 0,
      taxable: 100,
      tax: 5,
      net: 105
    }]
  });
  assert.deepEqual(printed, {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice honors SAVE10 maximum discount and calculates GST after the discount', function () {
  var items = [{
    id: 2,
    name: 'Tea',
    sku: 'TEA-1',
    hsn: '0902',
    price: 5000,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 873);
  assert.equal(billed.total, 5723);

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 873);
  assert.equal(printed.total, 5723);
});

test('invoice follows coupon eligibility rules used for billing', function () {
  var items = [{
    id: 3,
    name: 'Coffee',
    sku: 'COFFEE-1',
    hsn: '0901',
    price: 100,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'DIWALI20');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(billed.discount, 0);
  assert.equal(billed.tax, 18);
  assert.equal(billed.total, 118);

  assert.equal(printed.discount, 0);
  assert.equal(printed.tax, 18);
  assert.equal(printed.total, 118);
});

test('printed invoice has no reconciliation notice when its total matches the stored billed total', function () {
  var html = invoice.render({
    id: 42,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    total: 105
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
