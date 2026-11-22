var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

// This fixture stays in memory; these tests never import lib/store or read data/db.json.
function savedOrder() {
  var items = [{
    id: 1,
    name: 'Rice 5kg',
    sku: 'GRN-001',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 9001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: pricing applies the HSN rate after the capped coupon discount', function () {
  var order = savedOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    line: totals.lines[0]
  }, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    line: {
      id: 1,
      name: 'Rice 5kg',
      hsn: '1006',
      gstPercent: 5,
      gross: 2000,
      discount: 150,
      taxable: 1850,
      tax: 92.5,
      net: 1942.5
    }
  });
});

test('CURRENT BEHAVIOUR: invoice applies the billed HSN rate and capped coupon discount', function () {
  var order = savedOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    row: figures.rows[0]
  }, {
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    row: {
      name: 'Rice 5kg',
      sku: 'GRN-001',
      hsn: '1006',
      qty: 1,
      price: 2000,
      gstPercent: 5,
      line: 2000,
      lineTax: 92.5
    }
  });
});

test('CURRENT BEHAVIOUR: printable invoice does not show a reconciliation warning when totals match', function () {
  var order = savedOrder();
  var html = invoice.render(order);

  assert.equal(order.total, 1942.5);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice total and GST breakdown match the amounts used when the customer was billed', function () {
  var order = savedOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, billed.lines[0].tax);
});
