var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function billedOrder(items, coupon) {
  var billed = pricing.computeTotals(items, coupon || '');

  return {
    id: 41,
    date: '2026-11-21',
    customer: 'Characterization Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('billing uses the HSN slab to calculate GST and the recorded total', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 200, qty: 1 }
  ]);

  assert.deepEqual({
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total
  }, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    total: 210
  });
});

test('invoice total and GST breakdown match what the customer was billed', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 500, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    cgst: order.tax / 2,
    sgst: order.tax / 2,
    total: order.total
  });
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 45 },
    { gstPercent: 18, lineTax: 81 }
  ]);
});

test('invoice uses the HSN slab when gstRate is absent', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 200, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 10);
  assert.equal(order.total, 210);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 10);
  assert.equal(figures.cgst, 5);
  assert.equal(figures.sgst, 5);
  assert.equal(figures.total, 210);
});

test('invoice applies SAVE10 to the subtotal with its cap before GST', function () {
  var order = billedOrder([
    { id: 2, name: 'Bulk rice', sku: 'BULK', hsn: '1006', gstRate: 5, price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    discount: order.discount,
    tax: order.tax,
    total: order.total
  }, {
    discount: 150,
    tax: 92.5,
    total: 1942.5
  });
  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total
  }, {
    discount: 150,
    tax: 92.5,
    total: 1942.5
  });
});

test('invoice accepts a decimal gstRate', function () {
  var order = billedOrder([
    { id: 3, name: 'Decimal rate item', sku: 'DEC', gstRate: 0.05, price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});

test('rendered invoice matches billing without a reconciliation warning', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 200, qty: 1 }
  ]);
  var html = invoice.render(order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹10\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹210\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
