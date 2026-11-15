var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function order(id, item, coupon) {
  var totals = pricing.computeTotals([item], coupon || '');
  return {
    id: id,
    date: '2026-11-15',
    customer: 'Test Customer',
    coupon: coupon || '',
    items: [item],
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice matches checkout GST and capped coupon totals for the reported orders', function () {
  var anil = order(1002, {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1020,
    qty: 1
  }, 'SAVE10');
  var kalyani = order(1004, {
    id: 2,
    name: 'Packaged tea',
    hsn: '0902',
    price: 2240,
    qty: 1
  }, 'SAVE10');
  var fivePercent = order(1001, {
    id: 3,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  });
  var twelvePercent = order(1007, {
    id: 4,
    name: 'Ghee',
    hsn: '0405',
    price: 1000,
    qty: 1
  });

  [anil, kalyani, fivePercent, twelvePercent].forEach(function (current) {
    var printed = invoice.computeInvoiceFigures(current);
    assert.equal(printed.discount, current.discount);
    assert.equal(printed.tax, current.tax);
    assert.equal(printed.total, current.total);
  });
});

test('invoice applies SAVE10 to order 1002 subtotal and uses its HSN rate', function () {
  var current = order(1002, {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1020,
    qty: 1
  }, 'SAVE10');

  var checkout = pricing.computeTotals(current.items, current.coupon);
  var printed = invoice.computeInvoiceFigures(current);

  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);
  assert.equal(printed.tax, 45.9);
  assert.equal(printed.discount, 102);
  assert.equal(printed.total, 963.9);
});

test('invoice respects the configured ₹150 SAVE10 cap', function () {
  var current = order(1004, {
    id: 2,
    name: 'Packaged tea',
    hsn: '0902',
    price: 2240,
    qty: 1
  }, 'SAVE10');

  var printed = invoice.computeInvoiceFigures(current);

  assert.equal(current.discount, 150);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 376.2);
  assert.equal(printed.total, 2466.2);
});

test('invoice uses 5% and 12% HSN slabs for non-coupon orders', function () {
  var fivePercent = order(1001, {
    id: 3,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  });
  var twelvePercent = order(1007, {
    id: 4,
    name: 'Ghee',
    hsn: '0405',
    price: 1000,
    qty: 1
  });

  assert.equal(fivePercent.tax, 50);
  assert.equal(invoice.computeInvoiceFigures(fivePercent).tax, 50);
  assert.equal(twelvePercent.tax, 120);
  assert.equal(invoice.computeInvoiceFigures(twelvePercent).tax, 120);
  assert.equal(invoice.computeInvoiceFigures(fivePercent).rows[0].gstPercent, 5);
  assert.equal(invoice.computeInvoiceFigures(twelvePercent).rows[0].gstPercent, 12);
});

test('no-coupon order with only 18% items matches checkout', function () {
  var current = order(1008, {
    id: 5,
    name: 'Packaged tea',
    hsn: '0902',
    price: 1000,
    qty: 1
  });
  var printed = invoice.computeInvoiceFigures(current);

  assert.equal(printed.tax, current.tax);
  assert.equal(printed.total, current.total);
});

test('GST reconciliation matches the corrected invoice figures for in-memory orders', function () {
  var db = {
    orders: [
      order(1001, { id: 3, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }),
      order(1002, { id: 1, name: 'Rice', hsn: '1006', price: 1020, qty: 1 }, 'SAVE10'),
      order(1004, { id: 2, name: 'Packaged tea', hsn: '0902', price: 2240, qty: 1 }, 'SAVE10'),
      order(1007, { id: 4, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }),
      order(1008, { id: 5, name: 'Packaged tea', hsn: '0902', price: 1000, qty: 1 })
    ]
  };

  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 5);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual(reconciliation.rows.map(function (row) {
    return [row.orderId, row.matched];
  }), [
    [1001, true],
    [1002, true],
    [1004, true],
    [1007, true],
    [1008, true]
  ]);
});
