var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function riceOrder(overrides) {
  return Object.assign({
    id: 41,
    date: '2026-11-28',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  }, overrides || {});
}

test('invoice matches the billed HSN tax, coupon discount, and split GST amounts', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
  var html = invoice.render(Object.assign(riceOrder(), {
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }));
  assert.match(html, /CGST<\/td>/);
  assert.match(html, /SGST<\/td>/);
  assert.match(html, /₹945\.00/);
});

test('invoice uses the checkout HSN slab for stored order lines', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice uses checkout coupon calculation and post-discount taxable values', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 945);
  assert.equal(printed.discount, 100);
  assert.equal(printed.tax, 45);
  assert.equal(printed.rows[0].lineTax, 45);
  assert.equal(printed.total, 945);
});

test('GST reconciliation matches an invoice to the recorded checkout figures', function () {
  var order = riceOrder();
  var result = reports.getGstReconciliation({ orders: [order], products: [], customers: [], settlements: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 41,
    date: '2026-11-28',
    customer: 'In-memory customer',
    coupon: '',
    ledgerSubtotal: 100,
    ledgerDiscount: 0,
    ledgerTax: 5,
    ledgerTotal: 105,
    invoiceDiscount: 0,
    invoiceTax: 5,
    invoiceTotal: 105,
    delta: 0,
    matched: true
  });
});
