var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderWith(overrides) {
  var order = {
    id: 9001,
    date: '01/04/2022',
    customer: 'Characterization Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0
  };

  Object.keys(overrides || {}).forEach(function (key) {
    order[key] = overrides[key];
  });

  return order;
}

test('invoice uses the same HSN GST breakdown as the billed order', function () {
  var items = [{
    id: 1,
    sku: 'GRN-TEST',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(orderWith({ items: items }));

  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.equal(printed.total, 105);
});

test('invoice uses the same capped discount and post-discount GST as the billed order', function () {
  var items = [{
    id: 1,
    sku: 'GRN-BULK',
    name: 'Bulk Rice',
    hsn: '1006',
    price: 2240,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(orderWith({
    items: items,
    coupon: 'SAVE10'
  }));

  assert.deepEqual({
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }, {
    discount: 150,
    tax: 104.5,
    total: 2194.5
  });

  assert.deepEqual({
    discount: printed.discount,
    tax: printed.tax,
    total: printed.total
  }, {
    discount: 150,
    tax: 104.5,
    total: 2194.5
  });
});

test('reconciliation matches invoices to billed totals and skips cancelled orders', function () {
  var hsnItem = {
    id: 1,
    sku: 'GRN-TEST',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  };
  var matchingItem = {
    id: 8,
    sku: 'BEV-TEST',
    name: 'Tea',
    hsn: '0902',
    price: 100,
    qty: 1
  };
  var db = {
    orders: [
      orderWith({
        id: 1,
        items: [hsnItem],
        subtotal: 100,
        tax: 5,
        total: 105
      }),
      orderWith({
        id: 2,
        items: [matchingItem],
        subtotal: 100,
        tax: 18,
        total: 118
      }),
      orderWith({
        id: 3,
        status: 'cancelled',
        items: [hsnItem],
        subtotal: 100,
        tax: 5,
        total: 105
      })
    ]
  };

  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(function (row) {
    return {
      orderId: row.orderId,
      invoiceTax: row.invoiceTax,
      invoiceTotal: row.invoiceTotal,
      delta: row.delta,
      matched: row.matched
    };
  }), [
    { orderId: 1, invoiceTax: 5, invoiceTotal: 105, delta: 0, matched: true },
    { orderId: 2, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: true }
  ]);
});

test('rendered invoice displays the billed total without a reconciliation warning', function () {
  var html = invoice.render(orderWith({
    id: 44,
    items: [{
      id: 1,
      sku: 'GRN-TEST',
      name: 'Rice',
      hsn: '1006',
      price: 100,
      qty: 1
    }],
    subtotal: 100,
    tax: 5,
    total: 105
  }));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">.*105\.00/);
});
