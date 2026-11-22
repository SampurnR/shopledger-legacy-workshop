var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice uses the billed HSN slab when an item has no explicit gstRate', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];
  var ledger = pricing.computeTotals(items, '');
  var renderedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(ledger, {
    subtotal: 100,
    discount: 0,
    taxable: 100,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 0,
      taxable: 100,
      tax: 5,
      net: 105
    }]
  });
  assert.deepEqual(renderedInvoice, {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice applies SAVE10 before GST and respects its maximum discount cap', function () {
  var items = [{
    id: 5,
    name: 'Groundnut Oil',
    hsn: '1508',
    price: 1120,
    qty: 2
  }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var renderedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(ledger, {
    subtotal: 2240,
    discount: 150,
    taxable: 2090,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    lines: [{
      id: 5,
      name: 'Groundnut Oil',
      hsn: '1508',
      gstPercent: 5,
      gross: 2240,
      discount: 150,
      taxable: 2090,
      tax: 104.5,
      net: 2194.5
    }]
  });
  assert.deepEqual(renderedInvoice, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [{
      name: 'Groundnut Oil',
      sku: '-',
      hsn: '1508',
      qty: 2,
      price: 1120,
      gstPercent: 5,
      line: 2240,
      lineTax: 104.5
    }]
  });
});

test('GST reconciliation reports matching invoice and ledger figures from in-memory orders', function () {
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 77,
      date: '01/01/2022',
      customer: 'Walk-in',
      status: 'completed',
      coupon: '',
      items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }, {
      id: 78,
      date: '01/01/2022',
      customer: 'Walk-in',
      status: 'cancelled',
      coupon: '',
      items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 77,
      date: '01/01/2022',
      customer: 'Walk-in',
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
    }]
  });
});
