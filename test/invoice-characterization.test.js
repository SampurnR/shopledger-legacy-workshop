'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function riceLine(price, qty) {
  return {
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: price,
    qty: qty
  };
}

test('checkout totals apply HSN GST after the cart discount', function () {
  var items = [
    riceLine(640, 1),
    {
      id: 6,
      sku: 'DRY-001',
      name: 'A2 Gir Cow Ghee 500ml',
      hsn: '0405',
      price: 450,
      qty: 1
    }
  ];

  var result = pricing.computeTotals(items, 'SAVE10');

  assert.deepStrictEqual(result, {
    subtotal: 1090,
    discount: 109,
    taxable: 981,
    tax: 77.4,
    cgst: 38.7,
    sgst: 38.7,
    total: 1058.4,
    lines: [
      {
        id: 1,
        name: 'Indrayani Basmati Rice 5kg',
        hsn: '1006',
        gstPercent: 5,
        gross: 640,
        discount: 64,
        taxable: 576,
        tax: 28.8,
        net: 604.8
      },
      {
        id: 6,
        name: 'A2 Gir Cow Ghee 500ml',
        hsn: '0405',
        gstPercent: 12,
        gross: 450,
        discount: 45,
        taxable: 405,
        tax: 48.6,
        net: 453.6
      }
    ]
  });
});

test('invoice total and GST breakdown match the billed order', function () {
  var items = [
    riceLine(640, 1),
    {
      id: 6,
      sku: 'DRY-001',
      name: 'A2 Gir Cow Ghee 500ml',
      hsn: '0405',
      price: 450,
      qty: 1
    }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10'
  });

  assert.deepStrictEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total
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

test('invoice uses HSN slab when gstRate is absent', function () {
  var items = [riceLine(640, 1)];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepStrictEqual(billed, {
    subtotal: 640,
    discount: 0,
    taxable: 640,
    tax: 32,
    cgst: 16,
    sgst: 16,
    total: 672,
    lines: [
      {
        id: 1,
        name: 'Indrayani Basmati Rice 5kg',
        hsn: '1006',
        gstPercent: 5,
        gross: 640,
        discount: 0,
        taxable: 640,
        tax: 32,
        net: 672
      }
    ]
  });
  assert.deepStrictEqual(printed, {
    subtotal: 640,
    discount: 0,
    tax: 32,
    cgst: 16,
    sgst: 16,
    total: 672,
    rows: [
      {
        name: 'Indrayani Basmati Rice 5kg',
        sku: 'GRN-001',
        hsn: '1006',
        qty: 1,
        price: 640,
        gstPercent: 5,
        line: 640,
        lineTax: 32
      }
    ]
  });
});

test('invoice percentage coupon uses subtotal and honors configured cap', function () {
  var items = [riceLine(3000, 1)];
  var billed = pricing.computeTotals(items, 'WHOLESALE15');
  var printed = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'WHOLESALE15'
  });

  assert.strictEqual(billed.discount, 400);
  assert.strictEqual(billed.tax, 130);
  assert.strictEqual(billed.total, 2730);

  assert.strictEqual(printed.discount, 400);
  assert.strictEqual(printed.tax, 130);
  assert.strictEqual(printed.cgst, 65);
  assert.strictEqual(printed.sgst, 65);
  assert.strictEqual(printed.total, 2730);
});

test('reconciliation marks matching invoice and skips cancelled order', function () {
  var items = [riceLine(640, 1)];
  var billed = pricing.computeTotals(items, '');
  var db = {
    orders: [
      {
        id: 1001,
        date: '22/11/2026',
        customer: 'Walk-in',
        status: 'completed',
        coupon: '',
        items: items,
        subtotal: billed.subtotal,
        discount: billed.discount,
        tax: billed.tax,
        total: billed.total
      },
      {
        id: 1002,
        status: 'cancelled',
        items: items,
        subtotal: billed.subtotal,
        discount: billed.discount,
        tax: billed.tax,
        total: billed.total
      }
    ]
  };

  var result = reports.getGstReconciliation(db);

  assert.strictEqual(result.totalChecked, 1);
  assert.strictEqual(result.mismatchCount, 0);
  assert.strictEqual(result.totalDelta, 0);
  assert.deepStrictEqual(result.rows[0], {
    orderId: 1001,
    date: '22/11/2026',
    customer: 'Walk-in',
    coupon: '',
    ledgerSubtotal: 640,
    ledgerDiscount: 0,
    ledgerTax: 32,
    ledgerTotal: 672,
    invoiceDiscount: 0,
    invoiceTax: 32,
    invoiceTotal: 672,
    delta: 0,
    matched: true
  });
});
