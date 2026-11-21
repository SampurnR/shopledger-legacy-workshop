var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures match the billed HSN GST breakdown', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
});

test('invoice figures use the billed 5% HSN GST slab', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(billed, {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 0,
      taxable: 200,
      tax: 10,
      net: 210
    }]
  });

  assert.deepEqual(printed, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }]
  });
});

test('printed SAVE10 invoice keeps the coupon cap and pre-tax calculation', function () {
  var items = [{ id: 2, name: 'Dal', hsn: '0713', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.cgst, 46.25);
  assert.equal(printed.sgst, 46.25);
  assert.equal(printed.total, 1942.5);
});

test('printed discounted invoice apportions GST across mixed HSN line items', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 157.25);
  assert.equal(printed.cgst, 78.63);
  assert.equal(printed.sgst, 78.62);
  assert.equal(printed.total, 2007.25);
  assert.deepEqual(printed.rows, [
    {
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 1000,
      gstPercent: 5,
      line: 1000,
      lineTax: 46.25
    },
    {
      name: 'Ghee',
      sku: '-',
      hsn: '0405',
      qty: 1,
      price: 1000,
      gstPercent: 12,
      line: 1000,
      lineTax: 111
    }
  ]);
});

test('GST reconciliation matches invoice figures with the billed order totals', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var reconciliation = reports.getGstReconciliation({
    orders: [{
      id: 1001,
      date: '01/01/2022',
      customer: 'Walk-in',
      coupon: '',
      items: items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1001,
    date: '01/01/2022',
    customer: 'Walk-in',
    coupon: '',
    ledgerSubtotal: 200,
    ledgerDiscount: 0,
    ledgerTax: 10,
    ledgerTotal: 210,
    invoiceDiscount: 0,
    invoiceTax: 10,
    invoiceTotal: 210,
    delta: 0,
    matched: true
  });
});
