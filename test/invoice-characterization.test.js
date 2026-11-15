var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice uses the HSN GST slab used to bill the order', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }];
  var billed = pricing.computeTotals(items, '');
  var renderedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(billed, {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 0,
      taxable: 200,
      tax: 10,
      net: 210
    }]
  });
  assert.deepEqual(renderedInvoice, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }]
  });
});

test('invoice uses the billed HSN GST total for an order line without gstRate', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }];
  var billed = pricing.computeTotals(items, '');
  var renderedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(renderedInvoice.tax, billed.tax);
  assert.equal(renderedInvoice.total, billed.total);
  assert.equal(renderedInvoice.rows[0].gstPercent, 5);
});

test('invoice applies percentage coupons to the billed pre-tax taxable amount', function () {
  var items = [{
    id: 2,
    name: 'Dal',
    hsn: '0713',
    price: 1000,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var renderedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 47.5);
  assert.equal(billed.total, 997.5);
  assert.equal(renderedInvoice.discount, 50);
  assert.equal(renderedInvoice.tax, 47.5);
  assert.equal(renderedInvoice.total, 997.5);
});

test('invoice preserves decimal gstRate values used by billing', function () {
  var items = [{
    id: 3,
    name: 'Explicit-rate item',
    hsn: '1006',
    gstRate: 0.05,
    price: 100,
    qty: 1
  }];

  assert.equal(pricing.computeTotals(items, '').tax, 5);
  assert.deepEqual(invoice.computeInvoiceFigures({ items: items, coupon: '' }), {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Explicit-rate item',
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

test('reconciliation reports a matching invoice and ledger for an HSN-billed order', function () {
  var db = {
    orders: [{
      id: 42,
      date: '2026-11-15',
      customer: 'Asha',
      coupon: '',
      items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
      subtotal: 200,
      discount: 0,
      tax: 10,
      total: 210
    }, {
      id: 43,
      status: 'cancelled',
      items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
      subtotal: 200,
      discount: 0,
      tax: 10,
      total: 210
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 42,
      date: '2026-11-15',
      customer: 'Asha',
      coupon: '',
      ledgerSubtotal: 200,
      ledgerDiscount: 0,
      ledgerTax: 10,
      ledgerTotal: 210,
      invoiceDiscount: 0,
      invoiceTax: 10,
      invoiceTotal: 210,
      delta: 0,
      matched: true
    }]
  });
});

test('rendered invoice presents the billed total without a reconciliation notice', function () {
  var html = invoice.render({
    id: 42,
    date: '2026-11-15',
    customer: 'Asha',
    paymentMode: 'cash',
    coupon: '',
    total: 210,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }]
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹210\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
