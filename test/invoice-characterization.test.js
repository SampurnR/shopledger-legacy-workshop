var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1201,
    date: '21/11/2026',
    customer: 'Characterization Customer',
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

test('billing uses the HSN slab and splits GST evenly', function () {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];

  var totals = pricing.computeTotals(items, '');

  assert.deepEqual(totals, {
    subtotal: 1000,
    discount: 0,
    taxable: 1000,
    tax: 50,
    cgst: 25,
    sgst: 25,
    total: 1050,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 0,
      taxable: 1000,
      tax: 50,
      net: 1050
    }]
  });
});

test('invoice total and GST breakdown match the billed order', function () {
  var order = billedOrder([{
    id: 6,
    sku: 'RICE-3',
    name: 'Customer Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }]);

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 25);
  assert.equal(figures.sgst, 25);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice uses the HSN slab when gstRate is absent', function () {
  var order = billedOrder([{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }]);

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 50);
  assert.equal(order.total, 1050);
  assert.equal(figures.tax, 50);
  assert.equal(figures.cgst, 25);
  assert.equal(figures.sgst, 25);
  assert.equal(figures.total, 1050);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies SAVE10 to the subtotal and honors its discount cap', function () {
  var order = billedOrder([{
    id: 2,
    sku: 'RICE-2',
    name: 'Bulk Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }], 'SAVE10');

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 92.5);
  assert.equal(order.total, 1942.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.cgst, 46.25);
  assert.equal(figures.sgst, 46.25);
  assert.equal(figures.total, 1942.5);
});

test('rendered invoice does not warn when its total matches the billed total', function () {
  var order = billedOrder([{
    id: 3,
    sku: 'DAL-1',
    name: 'Dal',
    hsn: '0713',
    price: 500,
    qty: 1
  }]);

  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('reconciliation marks matching invoice total and GST figures', function () {
  var order = billedOrder([{
    id: 4,
    sku: 'POHA-1',
    name: 'Poha',
    hsn: '1104',
    price: 1000,
    qty: 1
  }]);
  var db = { orders: [order] };

  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1201,
    date: '21/11/2026',
    customer: 'Characterization Customer',
    coupon: '',
    ledgerSubtotal: 1000,
    ledgerDiscount: 0,
    ledgerTax: 50,
    ledgerTotal: 1050,
    invoiceDiscount: 0,
    invoiceTax: 50,
    invoiceTotal: 1050,
    delta: 0,
    matched: true
  });
});

test('reconciliation excludes cancelled orders', function () {
  var order = billedOrder([{
    id: 5,
    sku: 'OIL-1',
    name: 'Oil',
    hsn: '1512',
    price: 1000,
    qty: 1
  }]);
  order.status = 'cancelled';

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(reconciliation, {
    totalChecked: 0,
    mismatchCount: 0,
    totalDelta: 0,
    rows: []
  });
});
