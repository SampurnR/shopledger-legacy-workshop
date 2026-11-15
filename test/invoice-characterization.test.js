var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');
var orders = require('../lib/orders');

function billedOrder(items, coupon) {
  var db = { orders: [], nextOrderId: 1 };
  return orders.add(db, Object.assign({
    date: '15/11/2026', items: items, coupon: coupon || ''
  }, pricing.computeTotals(items, coupon)));
}

function assertInvoiceMatchesCheckout(order) {
  var checkout = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax,
    printed.cgst, printed.sgst, printed.total],
  [checkout.subtotal, checkout.discount, checkout.tax,
    checkout.cgst, checkout.sgst, checkout.total]);
  assert.deepEqual(printed.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), checkout.lines.map(function (line) { return [line.gstPercent, line.tax]; }));
}

test('invoice matches checkout across HSN slabs and a capped coupon', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var order = billedOrder(items, 'SAVE10');
  assertInvoiceMatchesCheckout(order);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice matches checkout without a coupon and with HSN fallback', function () {
  assertInvoiceMatchesCheckout(billedOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Unknown HSN', hsn: '9999', price: 100, qty: 1 }
  ]));
});

test('invoice matches checkout for minimum, inactive, normalized, and flat coupon cases', function () {
  [
    billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'SAVE10'),
    billedOrder([{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }], 'DIWALI20'),
    billedOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], ' save10 '),
    billedOrder([{ name: 'Tea', hsn: '0902', price: 10, qty: 1 }], 'FLAT50')
  ].forEach(assertInvoiceMatchesCheckout);
});

test('invoice uses checkout GST override handling and line tax rounding', function () {
  assertInvoiceMatchesCheckout(billedOrder([
    { name: 'Percent override', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal override', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero override', price: 100, qty: 1, gstRate: 0 }
  ]));
  assertInvoiceMatchesCheckout(billedOrder([1, 2, 3].map(function (id) {
    return { id: id, name: 'Small line', price: 0.03, qty: 1, gstRate: 18 };
  })));
});

test('reconciliation reflects invoice matches and skips cancelled orders', function () {
  var order = billedOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  var cancelled = Object.assign({}, order, { id: 2, status: 'cancelled' });
  var recon = reports.getGstReconciliation({ orders: [order, cancelled] });
  assert.deepEqual([recon.totalChecked, recon.mismatchCount, recon.totalDelta], [1, 0, 0]);
  assert.equal(recon.rows[0].matched, true);
});
