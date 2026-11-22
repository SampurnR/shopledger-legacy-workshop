var assert = require('node:assert/strict');
var test = require('node:test');

var db = require('../data/db.json');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function getOrder(id) {
  var order = db.orders.find(function (item) {
    return item.id === id;
  });

  assert.ok(order, 'expected fixture order #' + id + ' in data/db.json');
  return order;
}

function invoiceTotals(order) {
  var figures = invoice.computeInvoiceFigures(order);
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lines: figures.rows.map(function (row) {
      return {
        name: row.name,
        hsn: row.hsn,
        gstPercent: row.gstPercent,
        gross: row.line,
        tax: row.lineTax
      };
    })
  };
}

function checkoutTotals(order) {
  var figures = pricing.computeTotals(order.items, order.coupon);
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lines: figures.lines.map(function (line) {
      return {
        name: line.name,
        hsn: line.hsn,
        gstPercent: line.gstPercent,
        gross: line.gross,
        tax: line.tax
      };
    })
  };
}

function assertInvoiceMatchesCheckout(order) {
  var checkout = checkoutTotals(order);

  assert.deepEqual(invoiceTotals(order), checkout);
  assert.deepEqual(
    {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total
    },
    {
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      tax: checkout.tax,
      total: checkout.total
    }
  );

  return checkout;
}

test('Order #1002 invoice matches checkout for SAVE10 and 5% HSN items', function () {
  assertInvoiceMatchesCheckout(getOrder(1002));
});

test('Order #1004 invoice matches the capped SAVE10 discount and 5% GST', function () {
  assertInvoiceMatchesCheckout(getOrder(1004));
});

test('Order #1001 invoice preserves its 5% HSN rate alongside 18% GST', function () {
  assertInvoiceMatchesCheckout(getOrder(1001));
});

test('Order #1007 invoice preserves mixed 12% and 5% HSN rates', function () {
  assertInvoiceMatchesCheckout(getOrder(1007));
});

test('Order #1008 invoice continues to match checkout for all-18% items without a coupon', function () {
  assertInvoiceMatchesCheckout(getOrder(1008));
});

test('rendered Order #1002 invoice shows checkout total without a mismatch notice', function () {
  var order = getOrder(1002);
  var checkout = checkoutTotals(order);
  var html = invoice.render(order);

  assert.match(html, new RegExp('Invoice Total</td><td class="r">₹' + checkout.total.toFixed(2) + '</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
