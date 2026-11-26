var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function mixedRateItems() {
  return [
    {
      id: 1,
      sku: 'RICE-1',
      name: 'Rice',
      hsn: '1006',
      price: 100,
      qty: 1
    },
    {
      id: 2,
      sku: 'TEA-1',
      name: 'Tea',
      hsn: '0902',
      price: 200,
      qty: 1
    }
  ];
}

function billedOrder(coupon) {
  var items = mixedRateItems();
  var totals = pricing.computeTotals(items, coupon || '');

  return {
    id: 41,
    date: '2021-11-20',
    customer: 'Characterization Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('billing applies each HSN GST slab and splits the resulting tax', function () {
  var totals = pricing.computeTotals(mixedRateItems(), '');

  assert.deepEqual(totals, {
    subtotal: 300,
    discount: 0,
    taxable: 300,
    tax: 41,
    cgst: 20.5,
    sgst: 20.5,
    total: 341,
    lines: [
      {
        id: 1,
        name: 'Rice',
        hsn: '1006',
        gstPercent: 5,
        gross: 100,
        discount: 0,
        taxable: 100,
        tax: 5,
        net: 105
      },
      {
        id: 2,
        name: 'Tea',
        hsn: '0902',
        gstPercent: 18,
        gross: 200,
        discount: 0,
        taxable: 200,
        tax: 36,
        net: 236
      }
    ]
  });
});

test('billing apportions a flat coupon before calculating GST', function () {
  var totals = pricing.computeTotals(mixedRateItems(), 'FLAT50');

  assert.equal(totals.subtotal, 300);
  assert.equal(totals.discount, 50);
  assert.equal(totals.taxable, 250);
  assert.equal(totals.tax, 34.17);
  assert.equal(totals.cgst, 17.09);
  assert.equal(totals.sgst, 17.08);
  assert.equal(totals.total, 284.17);
  assert.deepEqual(totals.lines.map(function (line) {
    return {
      discount: line.discount,
      taxable: line.taxable,
      tax: line.tax
    };
  }), [
    { discount: 16.67, taxable: 83.33, tax: 4.17 },
    { discount: 33.33, taxable: 166.67, tax: 30 }
  ]);
});

test('invoice applies HSN slabs when order lines have no gstRate', function () {
  var order = billedOrder('');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 41);
  assert.equal(order.total, 341);
  assert.deepEqual(figures.rows.map(function (row) {
    return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { hsn: '1006', gstPercent: 5, lineTax: 5 },
    { hsn: '0902', gstPercent: 18, lineTax: 36 }
  ]);
  assert.equal(figures.tax, 41);
  assert.equal(figures.total, 341);
});

test('invoice apportions a flat coupon before calculating GST', function () {
  var order = billedOrder('FLAT50');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    discount: order.discount,
    tax: order.tax,
    total: order.total
  }, {
    discount: 50,
    tax: 34.17,
    total: 284.17
  });
  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    discount: 50,
    tax: 34.17,
    cgst: 17.09,
    sgst: 17.08,
    total: 284.17
  });
});

test('invoice percentage coupon uses subtotal and respects maxDiscount', function () {
  var items = [
    {
      id: 3,
      name: 'Bulk tea',
      hsn: '0902',
      price: 2000,
      qty: 1
    }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10'
  });

  assert.deepEqual({
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }, {
    discount: 150,
    tax: 333,
    total: 2183
  });
  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total
  }, {
    discount: 150,
    tax: 333,
    total: 2183
  });
});

test('invoice preserves billed figures after a coupon is deactivated', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{
      id: 3,
      name: 'Festive tea order',
      hsn: '0902',
      price: 2000,
      qty: 1
    }],
    coupon: 'DIWALI20',
    subtotal: 2000,
    discount: 250,
    tax: 315,
    total: 2065
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: 2000,
    discount: 250,
    tax: 315,
    total: 2065,
    lineTax: 315
  });
});

test('reconciliation still detects corrupted stored tax and total figures', function () {
  var order = billedOrder('');
  order.tax = 999;
  order.total = 1299;

  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].invoiceTax, 41);
  assert.equal(result.rows[0].invoiceTotal, 341);
  assert.equal(result.rows[0].matched, false);
});

test('reconciliation reports matching invoice and billed figures from in-memory orders', function () {
  var order = billedOrder('FLAT50');
  var cancelled = billedOrder('');
  cancelled.id = 42;
  cancelled.status = 'cancelled';

  var result = reports.getGstReconciliation({
    orders: [order, cancelled]
  });

  assert.deepEqual(result, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [
      {
        orderId: 41,
        date: '2021-11-20',
        customer: 'Characterization Customer',
        coupon: 'FLAT50',
        ledgerSubtotal: 300,
        ledgerDiscount: 50,
        ledgerTax: 34.17,
        ledgerTotal: 284.17,
        invoiceDiscount: 50,
        invoiceTax: 34.17,
        invoiceTotal: 284.17,
        delta: 0,
        matched: true
      }
    ]
  });
});

test('rendered invoice displays the billed total without a mismatch notice', function () {
  var html = invoice.render(billedOrder('FLAT50'));

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹34\.17/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹284\.17/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
