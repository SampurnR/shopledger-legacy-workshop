var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function order1002() {
  return {
    id: 1002,
    customer: 'Anil Kulkarni',
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Sunflower Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

function order1004() {
  return {
    id: 1004,
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5,
    items: [
      { id: 5, name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }
    ]
  };
}

test('checkout pricing for order #1002 uses HSN GST after SAVE10 discount', function () {
  var totals = pricing.computeTotals(order1002().items, 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total
    },
    { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  );
});

test('invoice for order #1002 uses HSN GST and discounts before tax', function () {
  var figures = invoice.computeInvoiceFigures(order1002());

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      lineGstPercents: figures.rows.map(function (row) { return row.gstPercent; })
    },
    {
      subtotal: 1020,
      discount: 102,
      tax: 45.9,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.9,
      lineGstPercents: [5, 5]
    }
  );
});

test('invoice for order #1004 applies the SAVE10 discount cap', function () {
  var figures = invoice.computeInvoiceFigures(order1004());

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      total: figures.total
    },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.equal(pricing.computeTotals(order1004().items, 'SAVE10').discount, 150);
});

test('invoice uses the configured GST slab for non-coupon 5% and 12% HSN items', function () {
  var fivePercent = invoice.computeInvoiceFigures({
    items: [{ name: 'Dal', hsn: '0713', price: 165, qty: 2 }]
  });
  var twelvePercent = invoice.computeInvoiceFigures({
    items: [{ name: 'Ghee', hsn: '0405', price: 450, qty: 2 }]
  });

  assert.deepEqual(
    { gstPercent: fivePercent.rows[0].gstPercent, tax: fivePercent.tax, total: fivePercent.total },
    { gstPercent: 5, tax: 16.5, total: 346.5 }
  );
  assert.deepEqual(
    { gstPercent: twelvePercent.rows[0].gstPercent, tax: twelvePercent.tax, total: twelvePercent.total },
    { gstPercent: 12, tax: 108, total: 1008 }
  );
});

test('GST reconciliation reports matching figures for in-memory orders', function () {
  var reconciliation = reports.getGstReconciliation({
    orders: [order1002(), order1004()]
  });

  assert.equal(reconciliation.totalChecked, 2);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(
    reconciliation.rows.map(function (row) {
      return { orderId: row.orderId, invoiceTax: row.invoiceTax, invoiceTotal: row.invoiceTotal, delta: row.delta, matched: row.matched };
    }),
    [
      { orderId: 1002, invoiceTax: 45.9, invoiceTotal: 963.9, delta: 0, matched: true },
      { orderId: 1004, invoiceTax: 104.5, invoiceTotal: 2194.5, delta: 0, matched: true }
    ]
  );
});

test('invoice figures match checkout totals for HSN GST and capped coupons', function () {
  [order1002(), order1004()].forEach(function (order) {
    var expected = pricing.computeTotals(order.items, order.coupon);
    var figures = invoice.computeInvoiceFigures(order);

    assert.deepEqual(
      {
        subtotal: figures.subtotal,
        discount: figures.discount,
        tax: figures.tax,
        cgst: figures.cgst,
        sgst: figures.sgst,
        total: figures.total
      },
      {
        subtotal: expected.subtotal,
        discount: expected.discount,
        tax: expected.tax,
        cgst: expected.cgst,
        sgst: expected.sgst,
        total: expected.total
      }
    );
  });
});
