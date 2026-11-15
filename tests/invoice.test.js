var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice GST matches POS HSN rates and applies coupon before tax', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var order = { items: items, coupon: 'WELCOME' };
  var pos = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, pos.tax);
  assert.equal(figures.discount, pos.discount);
  assert.equal(figures.total, pos.total);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
});
