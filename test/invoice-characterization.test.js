var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function riceOrder() {
  return {
    id: 9001,
    date: '01/01/2026',
    customer: 'Test Customer',
    coupon: 'SAVE10',
    status: 'completed',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

test('pricing records the billed HSN GST total after SAVE10 discount', function () {
  var order = riceOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(totals, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 4, name: 'Sunflower oil', hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
    ]
  });
});

test('invoice figures match the billed ledger totals', function () {
  var order = riceOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
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
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    }
  );
});

test('invoice uses HSN slabs and applies SAVE10 before GST', function () {
  var figures = invoice.computeInvoiceFigures(riceOrder());

  assert.deepEqual(figures, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Sunflower oil', sku: '-', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
});

test('invoice applies WHOLESALE15 maximum discount cap', function () {
  var order = {
    coupon: 'WHOLESALE15',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 3 }]
  };

  assert.equal(pricing.computeTotals(order.items, order.coupon).discount, 400);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 3000,
    discount: 400,
    tax: 130,
    cgst: 65,
    sgst: 65,
    total: 2730,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 3, price: 1000, gstPercent: 5, line: 3000, lineTax: 130 }
    ]
  });
});

test('GST reconciliation marks matching invoice and ledger figures', function () {
  var order = riceOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = billed.subtotal;
  order.discount = billed.discount;
  order.tax = billed.tax;
  order.total = billed.total;

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 9001,
    date: '01/01/2026',
    customer: 'Test Customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 1020,
    ledgerDiscount: 102,
    ledgerTax: 45.9,
    ledgerTotal: 963.9,
    invoiceDiscount: 102,
    invoiceTax: 45.9,
    invoiceTotal: 963.9,
    delta: 0,
    matched: true
  });
});
