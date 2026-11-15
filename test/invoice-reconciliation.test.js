var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice figures match order pricing for HSN slabs and coupon discounts', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Coffee', sku: 'COFFEE', hsn: '0901', price: 100, qty: 1 }
  ];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    total: invoiceFigures.total
  }, { subtotal: 200, discount: 10, tax: 21.85, total: 211.85 });
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 4.75], [18, 17.1]]);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
});

test('GST reconciliation matches the stored order pricing figures', function () {
  var db = {
    orders: [{
      id: 7,
      date: '15/11/2026',
      customer: 'Asha',
      coupon: 'WELCOME',
      subtotal: 200,
      discount: 10,
      tax: 21.85,
      total: 211.85,
      items: [
        { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
        { name: 'Coffee', hsn: '0901', price: 100, qty: 1 }
      ]
    }]
  };

  var result = reports.getGstReconciliation(db);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 7,
    date: '15/11/2026',
    customer: 'Asha',
    coupon: 'WELCOME',
    ledgerSubtotal: 200,
    ledgerDiscount: 10,
    ledgerTax: 21.85,
    ledgerTotal: 211.85,
    invoiceDiscount: 10,
    invoiceTax: 21.85,
    invoiceTotal: 211.85,
    delta: 0,
    matched: true
  });
});

test('invoice prints the CGST and SGST split used for order pricing', function () {
  var order = { id: 8, items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }] };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.match(html, /<td>CGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹2\.50<\/td>/);
});
