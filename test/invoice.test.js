var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice figures match the totals charged to the customer', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the same HSN slab and totals as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, total: billed.total });

  assert.deepEqual({ subtotal: billed.subtotal, tax: billed.tax, total: billed.total }, {
    subtotal: 100, tax: 5, total: 105
  });
  assert.deepEqual({ subtotal: figures.subtotal, tax: figures.tax, total: figures.total }, {
    subtotal: 100, tax: 5, total: 105
  });
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies the same coupon, taxable value, and line GST as order pricing', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME', total: billed.total });

  assert.deepEqual({ subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }, {
    subtotal: 100, discount: 5, tax: 17.1, total: 112.1
  });
  assert.deepEqual({ subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total }, {
    subtotal: 100, discount: 5, tax: 17.1, total: 112.1
  });
  assert.equal(figures.rows[0].line, 100);
  assert.equal(figures.rows[0].lineTax, 17.1);
});

test('invoice honors the pricing discount cap and computes GST after the discount', function () {
  var order = {
    items: [{ name: 'Bulk goods', price: 3000, qty: 1, hsn: '1006' }],
    coupon: 'WHOLESALE15'
  };
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 400);
  assert.equal(figures.discount, 400);
  assert.equal(figures.tax, 130);
  assert.equal(figures.total, 2730);
});

test('invoice uses order pricing line tax rounding and CGST/SGST split', function () {
  var order = { items: [
    { name: 'A', price: 0.03, qty: 1 },
    { name: 'B', price: 0.03, qty: 1 }
  ] };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].lineTax, 0.01);
  assert.equal(figures.rows[1].lineTax, 0.01);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
});

test('rendered invoice agrees with the stored order total without a reconciliation warning', function () {
  var html = invoice.render({
    id: 7,
    items: [{ name: 'Rice', price: 100, qty: 1, hsn: '1006' }],
    subtotal: 100,
    tax: 5,
    total: 105
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});
