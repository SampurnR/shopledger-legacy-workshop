var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var tax = require('../lib/tax');

function orderFrom(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '01/01/2022',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('pricing applies the HSN slab and splits GST into CGST and SGST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ], '');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total
  }, {
    subtotal: 100,
    discount: 0,
    taxable: 100,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105
  });
});

test('invoice uses the HSN slab recorded on each order line', function () {
  var order = orderFrom([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice matches the billed total and per-line GST breakdown', function () {
  var order = orderFrom([
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { hsn: '1006', gstPercent: 5, lineTax: 28.8 },
    { hsn: '1512', gstPercent: 5, lineTax: 17.1 }
  ]);
});

test('invoice GST rate is resolved consistently with pricing', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', price: 100, qty: 1, gstRate: 0.05 }],
    coupon: ''
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
  assert.equal(tax.getRateForItem({ gstRate: 0.05 }), 0.05);
});

test('invoice SAVE10 discount matches pricing cap and post-discount GST', function () {
  var order = orderFrom([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 92.5);
  assert.equal(order.total, 1942.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.total, 1942.5);
});

test('invoice flat coupon reduces taxable value before GST, matching pricing', function () {
  var order = orderFrom([
    { id: 1, name: 'Rice', hsn: '1006', price: 400, qty: 1 }
  ], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(order.tax, 17.5);
  assert.equal(order.total, 367.5);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 17.5);
  assert.equal(figures.total, 367.5);
});

test('invoice does not apply a coupon below its minimum order value', function () {
  var order = orderFrom([
    { id: 1, name: 'Rice', hsn: '1006', price: 400, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 0);
  assert.equal(order.total, 420);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 420);
});
