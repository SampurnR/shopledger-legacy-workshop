var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice total and GST match the amount charged by the ledger', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }
  ];
  var charged = pricing.computeTotals(items, '');
  var order = { id: 101, items: items, coupon: '', subtotal: charged.subtotal, tax: charged.tax, total: charged.total };
  var billedInvoice = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(billedInvoice.total, charged.total);
  assert.equal(billedInvoice.tax, charged.tax);
  assert.equal(billedInvoice.cgst, charged.cgst);
  assert.equal(billedInvoice.sgst, charged.sgst);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹10\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹210\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice HSN GST rates match the ledger totals and split', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }
  ];
  var ledger = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: printedInvoice.subtotal, tax: printedInvoice.tax, cgst: printedInvoice.cgst, sgst: printedInvoice.sgst, total: printedInvoice.total },
    { subtotal: ledger.subtotal, tax: ledger.tax, cgst: ledger.cgst, sgst: ledger.sgst, total: ledger.total }
  );
});

test('invoice gstRate values use the same decimal or percent interpretation as the ledger', function () {
  var items = [
    { id: 2, name: 'Tea', hsn: '0902', gstRate: 0.18, price: 100, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledger.tax, 18);
  assert.equal(ledger.total, 118);
  assert.equal(printedInvoice.tax, 18);
  assert.equal(printedInvoice.total, 118);
});

test('invoice coupon discount and tax match the ledger calculation', function () {
  var items = [
    { id: 3, name: 'Rice basket', hsn: '1006', price: 600, qty: 1 }
  ];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { discount: 60, tax: 27, total: 567 }
  );
  assert.deepEqual(
    { discount: printedInvoice.discount, tax: printedInvoice.tax, total: printedInvoice.total },
    { discount: 60, tax: 27, total: 567 }
  );
});

test('invoice CGST and SGST use the same rounded line tax split as the ledger', function () {
  var printedInvoice = invoice.computeInvoiceFigures({
    items: [
      { name: 'A', price: 0.05, qty: 1, gstRate: 10 },
      { name: 'B', price: 0.05, qty: 1, gstRate: 10 }
    ],
    coupon: ''
  });

  assert.equal(printedInvoice.tax, 0.02);
  assert.equal(printedInvoice.cgst, 0.01);
  assert.equal(printedInvoice.sgst, 0.01);
});
