var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice matches the HSN tax breakdown and total billed by pricing', function () {
  var items = [{ id: 3, sku: 'POHA-3', name: 'Poha', hsn: '1104', price: 48, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 1003,
    date: '2026-11-28',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the billed HSN tax rate when line items have no gstRate', function () {
  var items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 1001,
    date: '2026-11-28',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: billed.subtotal, tax: billed.tax, total: billed.total }, {
    subtotal: 100,
    tax: 5,
    total: 105
  });
  assert.deepEqual({ subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, total: invoiceFigures.total }, {
    subtotal: 100,
    tax: 5,
    total: 105
  });
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the billed SAVE10 discount cap and total', function () {
  var items = [{ id: 2, sku: 'RICE-2', name: 'Bulk rice', hsn: '1006', price: 3000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 1002,
    date: '2026-11-28',
    customer: 'Wholesale customer',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }, {
    subtotal: 3000,
    discount: 150,
    tax: 142.5,
    total: 2992.5
  });
  assert.deepEqual({ subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total }, {
    subtotal: 3000,
    discount: 150,
    tax: 142.5,
    total: 2992.5
  });
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
