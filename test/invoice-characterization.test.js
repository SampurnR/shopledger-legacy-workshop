var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function discountedMixedSlabItems() {
  return [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ];
}

function createBilledOrder() {
  var totals = pricing.computeTotals(discountedMixedSlabItems(), 'WELCOME');
  var db = { nextOrderId: 1, orders: [] };

  return orders.add(db, {
    date: '2021-11-01',
    customer: 'Walk-in',
    items: discountedMixedSlabItems(),
    coupon: 'WELCOME',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice figures match the billed ledger total and GST breakdown', function () {
  var order = createBilledOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
});

test('CURRENT BEHAVIOUR: order ledger bills discounted HSN-specific GST totals', function () {
  var order = createBilledOrder();

  assert.deepEqual(
    {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total
    },
    { subtotal: 300, discount: 15, tax: 20.9, total: 305.9 }
  );
});

test('invoice uses post-discount HSN GST and the coupon discount charged by the ledger', function () {
  var figures = invoice.computeInvoiceFigures(createBilledOrder());

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      gstPercents: figures.rows.map(function (row) { return row.gstPercent; })
    },
    {
      subtotal: 300,
      discount: 15,
      tax: 20.9,
      cgst: 10.45,
      sgst: 10.45,
      total: 305.9,
      gstPercents: [5, 12]
    }
  );
});

test('GST reconciliation matches invoice figures to the billed ledger', function () {
  var reconciliation = reports.getGstReconciliation({
    orders: [createBilledOrder()]
  });

  assert.deepEqual(reconciliation, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1,
      date: '2021-11-01',
      customer: 'Walk-in',
      coupon: 'WELCOME',
      ledgerSubtotal: 300,
      ledgerDiscount: 15,
      ledgerTax: 20.9,
      ledgerTotal: 305.9,
      invoiceDiscount: 15,
      invoiceTax: 20.9,
      invoiceTotal: 305.9,
      delta: 0,
      matched: true
    }]
  });
});
