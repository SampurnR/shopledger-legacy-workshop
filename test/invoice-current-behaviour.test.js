var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice figures match the customer-billed HSN GST and capped coupon total', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total,
    gstPercent: printed.rows[0].gstPercent,
    lineTax: printed.rows[0].lineTax
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: billed.lines[0].gstPercent,
    lineTax: billed.lines[0].tax
  });
});

test('invoice uses the HSN slab when gstRate is absent', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(billed, {
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
  assert.deepEqual(printed, {
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

test('invoice percentage discounts use the coupon cap before HSN GST', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
});

test('GST reconciliation matches an invoice with the stored billed order', function () {
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 101,
      customer: 'Walk-in',
      status: 'completed',
      coupon: '',
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105,
      items: [{
        id: 1,
        name: 'Rice',
        hsn: '1006',
        price: 100,
        qty: 1
      }]
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 101,
      date: undefined,
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
