var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice GST breakdown and total match the completed order ledger', function () {
  var order = {
    id: 7,
    date: '2026-11-22',
    customer: 'Customer',
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };

  var bill = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: bill.subtotal, discount: bill.discount, tax: bill.tax, cgst: bill.cgst, sgst: bill.sgst, total: bill.total },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.equal(bill.rows[0].gstPercent, 5);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(invoice.render(order), /Reconciliation Notice/);
});

test('invoice allocates a percent coupon and computes GST the same way as checkout', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 8,
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  var bill = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: bill.subtotal, discount: bill.discount, tax: bill.tax, total: bill.total },
    { subtotal: ledger.subtotal, discount: ledger.discount, tax: ledger.tax, total: ledger.total }
  );
  assert.equal(bill.rows[0].lineTax, ledger.lines[0].tax);
});

test('invoice interprets decimal gstRate values as fractions like checkout', function () {
  var item = { id: 3, name: 'Oil', price: 100, qty: 1, gstRate: 0.05 };
  var bill = invoice.computeInvoiceFigures({ items: [item] });

  assert.equal(bill.tax, 5);
  assert.equal(bill.rows[0].gstPercent, 5);
});
