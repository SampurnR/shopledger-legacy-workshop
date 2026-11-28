const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const orders = require('../lib/orders');

test('invoice uses checkout GST slabs and discounted taxable amounts', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 6 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 2 }
  ];
  const order = Object.assign({ items: items, coupon: 'WELCOME' }, pricing.computeTotals(items, 'WELCOME'));

  assert.deepEqual({
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total
  }, { subtotal: 800, discount: 40, tax: 62.7, total: 822.7 });

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 800,
    discount: 40,
    tax: 62.7,
    cgst: 31.35,
    sgst: 31.35,
    total: 822.7,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 6, price: 100, gstPercent: 5, line: 600, lineTax: 28.5 },
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 34.2 }
    ]
  });
  assert.equal(invoice.computeInvoiceFigures(order).total, order.total);
});

test('invoice preserves decimal GST rates', function () {
  const order = { items: [{ name: 'Rice', price: 100, qty: 1, gstRate: 0.05 }] };

  assert.equal(tax.getRateForItem(order.items[0]), 0.05);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{ name: 'Rice', sku: '-', hsn: '-', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 }]
  });
});

test('invoice line GST amounts reconcile to the rounded checkout GST total', function () {
  const order = { items: [
    { name: 'A', price: 0.05, qty: 1, gstRate: 18 },
    { name: 'B', price: 0.05, qty: 1, gstRate: 18 }
  ] };

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.12);
});

test('order creation stores supplied figures and invoice applies its current HSN calculation', function () {
  const db = { nextOrderId: 1, orders: [] };
  const order = orders.add(db, {
    items: [{ name: 'Rice', price: 100, qty: 1, hsn: '1006' }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.equal(order.total, 105);
  assert.equal(db.orders[0], order);
  assert.equal(invoice.computeInvoiceFigures(order).total, 105);
});
