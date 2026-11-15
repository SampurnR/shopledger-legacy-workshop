'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function riceLine(price) {
  // This matches the order line shape persisted by routes/orders.js.
  return {
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: price == null ? 100 : price,
    qty: 1
  };
}

test('invoice uses the billed HSN slab and matches the billed GST split', function () {
  var item = riceLine();
  var billed = pricing.computeTotals([item], '');
  var printed = invoice.computeInvoiceFigures({ items: [item], coupon: '' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total, gstPercent: printed.rows[0].gstPercent },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105, gstPercent: 5 }
  );
});

test('invoice coupon totals and line GST match the billed calculation', function () {
  var item = riceLine();
  var billed = pricing.computeTotals([item], 'WELCOME');
  var printed = invoice.computeInvoiceFigures({ items: [item], coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 100, discount: 5, tax: 4.75, total: 99.75 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total, gstPercent: printed.rows[0].gstPercent, lineTax: printed.rows[0].lineTax },
    { subtotal: 100, discount: 5, tax: 4.75, cgst: 2.38, sgst: 2.37, total: 99.75, gstPercent: 5, lineTax: 4.75 }
  );
});

test('GST reconciliation matches the order produced by the reported running-app scenario', function () {
  var item = riceLine(640);
  var billed = pricing.computeTotals([item], 'SAVE10');
  var order = {
    id: 1001,
    date: '15/11/2026',
    customer: 'Walk-in',
    status: 'completed',
    coupon: 'SAVE10',
    items: [item],
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    {
      ledgerTax: result.rows[0].ledgerTax,
      invoiceTax: result.rows[0].invoiceTax,
      ledgerTotal: result.rows[0].ledgerTotal,
      invoiceTotal: result.rows[0].invoiceTotal,
      delta: result.rows[0].delta,
      matched: result.rows[0].matched
    },
    { ledgerTax: 28.8, invoiceTax: 28.8, ledgerTotal: 604.8, invoiceTotal: 604.8, delta: 0, matched: true }
  );
});
