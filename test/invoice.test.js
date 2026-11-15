var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function recordOrder(db, items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '2021-11-15',
    items: items,
    coupon: coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
}

test('invoice agrees with the billed total for an item without HSN or a coupon', function () {
  var db = { orders: [], nextOrderId: 1001 };
  var order = recordOrder(db, [{ name: 'Legacy item', price: 100, qty: 1 }]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.strictEqual(order.total, 118);
  assert.strictEqual(figures.total, 118);
  assert.strictEqual(figures.tax, 18);
  assert.strictEqual(figures.cgst, 9);
  assert.strictEqual(figures.sgst, 9);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.strictEqual(reports.getGstReconciliation(db).rows[0].matched, true);
});

test('invoice matches the amount billed for mixed GST slabs and a capped coupon', function () {
  var db = { orders: [], nextOrderId: 1001 };
  var order = recordOrder(db, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 600, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 800, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.strictEqual(order.discount, 150);
  assert.strictEqual(order.tax, 144.3);
  assert.strictEqual(order.total, 1994.3);
  assert.deepStrictEqual(figures, {
    subtotal: 2000,
    discount: 150,
    tax: 144.3,
    cgst: 72.15,
    sgst: 72.15,
    total: 1994.3,
    rows: [
      {
        name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 600,
        gstPercent: 5, line: 1200, lineTax: 55.5
      },
      {
        name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 800,
        gstPercent: 12, line: 800, lineTax: 88.8
      }
    ]
  });

  var html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹55\.50/);
  assert.match(html, /12%<\/td><td class="r">₹88\.80/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹144\.30/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1994\.30/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  assert.deepStrictEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2021-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 2000,
      ledgerDiscount: 150,
      ledgerTax: 144.3,
      ledgerTotal: 1994.3,
      invoiceDiscount: 150,
      invoiceTax: 144.3,
      invoiceTotal: 1994.3,
      delta: 0,
      matched: true
    }]
  });
});

test('invoice applies GST after a flat coupon, as checkout does', function () {
  var db = { orders: [], nextOrderId: 1001 };
  var order = recordOrder(db, [{ name: 'Tea', price: 500, qty: 1, hsn: '0902' }], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(order);

  assert.strictEqual(order.discount, 50);
  assert.strictEqual(order.tax, 81);
  assert.strictEqual(order.total, 531);
  assert.strictEqual(figures.discount, 50);
  assert.strictEqual(figures.tax, 81);
  assert.strictEqual(figures.rows[0].lineTax, 81);
  assert.strictEqual(figures.total, 531);
});

test('invoice sums rounded line GST and splits it the same way as checkout', function () {
  var db = { orders: [], nextOrderId: 1001 };
  var order = recordOrder(db, [
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.strictEqual(order.tax, 0.02);
  assert.strictEqual(order.total, 0.08);
  assert.deepStrictEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.strictEqual(figures.tax, 0.02);
  assert.strictEqual(figures.cgst, 0.01);
  assert.strictEqual(figures.sgst, 0.01);
  assert.strictEqual(figures.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
