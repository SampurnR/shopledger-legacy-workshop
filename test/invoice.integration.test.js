'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function item(id, sku, name, hsn, price, qty) {
  return {
    id: id,
    sku: sku,
    name: name,
    hsn: hsn,
    price: price,
    qty: qty
  };
}

function order(items, coupon, totals) {
  return {
    id: 9001,
    date: '01/04/2022',
    customer: 'Test Customer',
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

test('renders discounted invoice GST and grand total', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(4, 'OIL-001', 'Sunflower Oil', '1512', 190, 2)
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var html = invoice.render(order(items, 'SAVE10', totals));

  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r" style="color:#16a34a">-₹102\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
});

test('omits mismatch warning when invoice and ledger figures agree', function () {
  var items = [
    item(5, 'OIL-002', 'Groundnut Oil', '1508', 1120, 2)
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var html = invoice.render(order(items, 'SAVE10', totals));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2194\.50/);
});

test('preserves name, SKU, HSN, quantity and unit price in invoice rows', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(6, 'DRY-001', 'Ghee', '0405', 450, 2)
  ];
  var totals = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures(order(items, '', totals));

  assert.deepEqual(
    figures.rows.map(function (row) {
      return {
        name: row.name,
        sku: row.sku,
        hsn: row.hsn,
        qty: row.qty,
        price: row.price
      };
    }),
    [
      { name: 'Rice', sku: 'GRN-001', hsn: '1006', qty: 1, price: 640 },
      { name: 'Ghee', sku: 'DRY-001', hsn: '0405', qty: 2, price: 450 }
    ]
  );
});

test('maps FLAT50 line gross and tax from canonical pricing', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(8, 'BEV-001', 'Tea', '0902', 140, 1)
  ];
  var totals = pricing.computeTotals(items, 'FLAT50');
  var figures = invoice.computeInvoiceFigures(order(items, 'FLAT50', totals));

  assert.deepEqual(
    figures.rows.map(function (row) {
      return { line: row.line, lineTax: row.lineTax };
    }),
    [
      { line: 640, lineTax: 29.95 },
      { line: 140, lineTax: 23.59 }
    ]
  );
  assert.deepEqual(
    figures.rows.map(function (row) {
      return { line: row.line, lineTax: row.lineTax };
    }),
    totals.lines.map(function (line) {
      return { line: line.gross, lineTax: line.tax };
    })
  );
});

test('handles missing items and coupon values without rows', function () {
  var noItems = invoice.computeInvoiceFigures({});
  var emptyItems = invoice.computeInvoiceFigures({ items: [], coupon: null });
  var zeroTotals = {
    subtotal: 0,
    discount: 0,
    tax: 0,
    cgst: 0,
    sgst: 0,
    total: 0,
    rows: []
  };

  assert.deepEqual(noItems, zeroTotals);
  assert.deepEqual(emptyItems, zeroTotals);
});

test('normalizes padded lowercase coupon codes consistently with checkout', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1)
  ];
  var totals = pricing.computeTotals(items, ' save10 ');
  var figures = invoice.computeInvoiceFigures(order(items, ' save10 ', totals));

  assert.deepEqual(figures, {
    subtotal: 640,
    discount: 64,
    tax: 28.8,
    cgst: 14.4,
    sgst: 14.4,
    total: 604.8,
    rows: [
      {
        name: 'Rice',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 640,
        gstPercent: 5,
        line: 640,
        lineTax: 28.8
      }
    ]
  });
});

test('keeps multi-line discounted line tax totals consistent', function () {
  var items = [
    item(1, 'GRN-001', 'Rice', '1006', 640, 1),
    item(8, 'BEV-001', 'Tea', '0902', 140, 1),
    item(3, 'GRN-003', 'Poha', '1104', 48, 1)
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order(items, 'SAVE10', totals));
  var summedLineTax = figures.rows.reduce(function (sum, row) {
    return sum + row.lineTax;
  }, 0);

  assert.equal(figures.tax, 53.64);
  assert.equal(summedLineTax, figures.tax);
  assert.equal(summedLineTax, totals.tax);
});
