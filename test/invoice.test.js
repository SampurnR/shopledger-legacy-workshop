var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('HSN-only order lines use the configured HSN slab in pricing and invoice', function () {
  // This mirrors the line shape saved by routes/orders.js: HSN is present, but gstRate is not.
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({
    id: 1, items: items, subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  });

  assert.equal(billed.tax, 10);
  assert.equal(billed.total, 210);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
});

test('invoice recalculates coupon discount and GST from item data', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 300, qty: 1 }];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var figures = invoice.computeInvoiceFigures({
    id: 2, items: items, coupon: 'FLAT50', subtotal: billed.subtotal,
    discount: billed.discount, tax: billed.tax, total: billed.total
  });
  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 295);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
});

test('invoice splits GST into rounded CGST and SGST values', function () {
  var order = {
    id: 3,
    items: [{ name: 'Tea', price: 100, qty: 1, gstRate: 18 }],
    total: 118
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.match(html, /<td>CGST<\/td><td class="r">[^<]*9\.00<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">[^<]*9\.00<\/td>/);
});

test('CURRENT BEHAVIOUR: invoice shows a reconciliation notice when stored ledger total differs', function () {
  var order = {
    id: 4,
    items: [{ name: 'Rice', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.total, 118);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*118\.00<\/td>/);
  assert.match(html, /Invoice computed total \([^)]*118\.00\) differs from Order Ledger recorded total \([^)]*105\.00\) by \+[^<]*13\.00\./);
});

test('invoice item breakdown reconciles allocated coupon discounts, GST, and billed total', function () {
  var items = [
    { id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var figures = invoice.computeInvoiceFigures({
    id: 1003, items: items, coupon: 'FLAT50', subtotal: billed.subtotal,
    discount: billed.discount, tax: billed.tax, total: billed.total
  });
  var html = invoice.render({
    id: 1003, items: items, coupon: 'FLAT50', subtotal: billed.subtotal,
    discount: billed.discount, tax: billed.tax, total: billed.total
  });

  assert.deepEqual(figures.rows.map(function (row) {
    return [row.discount, row.taxable, row.lineTax, row.lineTotal];
  }), [[32.5, 227.5, 27.3, 254.8], [17.5, 122.5, 22.05, 144.55]]);
  assert.equal(figures.rows.reduce(function (sum, row) { return sum + row.lineTotal; }, 0), 399.35);
  assert.equal(figures.total, billed.total);
  assert.match(html, /<th class="r">Discount<\/th><th class="r">Taxable<\/th>/);
  assert.match(html, /Butter[\s\S]*?₹32\.50[\s\S]*?₹227\.50[\s\S]*?₹27\.30[\s\S]*?₹254\.80/);
  assert.match(html, /Tea[\s\S]*?₹17\.50[\s\S]*?₹122\.50[\s\S]*?₹22\.05[\s\S]*?₹144\.55/);
});
