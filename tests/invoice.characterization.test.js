var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var billed = pricing.computeTotals(items, coupon || '');
  return {
    id: 1001,
    date: '01/01/2026',
    customer: 'Test customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice uses the billed discount, HSN tax, GST split, and total', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
    cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
  { subtotal: 2000, discount: 150, tax: 92.5,
    cgst: 46.25, sgst: 46.25, total: 1942.5 });
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [{ gstPercent: 5, lineTax: 92.5 }]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the billed HSN slabs for mixed-rate items', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 200, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ tax: order.tax, total: order.total }, { tax: 41, total: 341 });
  assert.deepEqual({ tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { tax: 41, cgst: 20.5, sgst: 20.5, total: 341 });
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
});

test('invoice uses the billed capped percentage coupon and post-discount GST', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount: order.discount, tax: order.tax, total: order.total },
    { discount: 150, tax: 92.5, total: 1942.5 });
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, cgst: figures.cgst,
    sgst: figures.sgst, total: figures.total },
  { discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice and checkout agree for an 18% item without a coupon', function () {
  var order = billedOrder([
    { id: 1, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ tax: order.tax, total: order.total }, { tax: 18, total: 118 });
  assert.deepEqual({ tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { tax: 18, cgst: 9, sgst: 9, total: 118 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation matches billed figures from in-memory orders', function () {
  var mismatched = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  var cancelled = Object.assign({}, mismatched, { id: 1002, status: 'cancelled' });
  var result = reports.getGstReconciliation({ orders: [mismatched, cancelled] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual({ ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta, matched: result.rows[0].matched },
  { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105,
    delta: 0, matched: true });
});
