var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function billedOrder(id, items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: id,
    date: '01/01/2022',
    customer: 'In-memory customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the HSN GST slab used by the order ledger', function () {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 2
  }];
  var order = billedOrder(1, items);

  assert.deepEqual(pricing.computeTotals(items, ''), {
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

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 10
    }]
  });
});

test('invoice applies capped coupons before calculating GST like the order ledger', function () {
  var items = [{
    id: 2,
    sku: 'RICE-BULK',
    name: 'Bulk rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];
  var order = billedOrder(2, items, 'SAVE10');
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 92.5);
  assert.equal(ledger.total, 1942.5);

  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
});

test('invoice honors an explicit GST override like the order ledger', function () {
  var order = {
    id: 3,
    items: [{
      id: 3,
      sku: 'OVERRIDE',
      name: 'GST override line',
      hsn: '1006',
      gstRate: 12,
      price: 100,
      qty: 1
    }],
    coupon: ''
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 12,
    cgst: 6,
    sgst: 6,
    total: 112,
    rows: [{
      name: 'GST override line',
      sku: 'OVERRIDE',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 12,
      line: 100,
      lineTax: 12
    }]
  });
});

test('reconciliation reports matching invoice and ledger figures for an in-memory order', function () {
  var order = billedOrder(4, [{
    id: 4,
    sku: 'DAL-1',
    name: 'Dal',
    hsn: '0713',
    price: 100,
    qty: 1
  }]);
  var result = reports.getGstReconciliation({
    products: [],
    customers: [],
    orders: [order]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 4,
    date: '01/01/2022',
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

test('invoice HTML matches the ledger total without a mismatch notice', function () {
  var order = billedOrder(5, [{
    id: 5,
    sku: 'RICE-2',
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1
  }]);
  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});
