'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures match the ledger figures for an HSN item', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { tax: printedInvoice.tax, total: printedInvoice.total },
    { tax: ledger.tax, total: ledger.total }
  );
});

test('invoice uses the HSN slab from the order line when gstRate is absent', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var order = { id: 1, items: items, total: 105, tax: 5 };

  assert.deepEqual(
    { tax: pricing.computeTotals(items, '').tax, total: pricing.computeTotals(items, '').total },
    { tax: 5, total: 105 }
  );
  assert.deepEqual(
    {
      tax: invoice.computeInvoiceFigures(order).tax,
      cgst: invoice.computeInvoiceFigures(order).cgst,
      sgst: invoice.computeInvoiceFigures(order).sgst,
      total: invoice.computeInvoiceFigures(order).total,
      lineGstPercent: invoice.computeInvoiceFigures(order).rows[0].gstPercent,
      lineTax: invoice.computeInvoiceFigures(order).rows[0].lineTax
    },
    { tax: 5, cgst: 2.5, sgst: 2.5, total: 105, lineGstPercent: 5, lineTax: 5 }
  );
});

test('invoice applies capped coupon to taxable value before calculating GST, matching ledger figures', function () {
  var items = [{ id: 2, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({
    id: 2,
    items: items,
    coupon: 'SAVE10',
    total: ledger.total,
    tax: ledger.tax
  });

  assert.deepEqual(
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { discount: 150, tax: 333, total: 2183 }
  );
  assert.deepEqual(
    { discount: printedInvoice.discount, tax: printedInvoice.tax, total: printedInvoice.total, lineTax: printedInvoice.rows[0].lineTax },
    { discount: 150, tax: 333, total: 2183, lineTax: 333 }
  );
});

test('invoice treats a decimal gstRate as a decimal rate, matching ledger pricing', function () {
  var items = [{ id: 3, name: 'Special item', gstRate: 0.05, price: 100, qty: 1 }];
  var order = { id: 3, items: items };

  assert.equal(pricing.computeTotals(items, '').tax, 5);
  assert.deepEqual(
    { tax: invoice.computeInvoiceFigures(order).tax, gstPercent: invoice.computeInvoiceFigures(order).rows[0].gstPercent },
    { tax: 5, gstPercent: 5 }
  );
});

test('GST reconciliation reports matching invoice and ledger figures', function () {
  var result = reports.getGstReconciliation({
    orders: [{
      id: 4,
      date: '2026-11-15',
      customer: 'In-memory customer',
      items: [{ id: 4, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }]
  });

  assert.deepEqual(
    { totalChecked: result.totalChecked, mismatchCount: result.mismatchCount, totalDelta: result.totalDelta },
    { totalChecked: 1, mismatchCount: 0, totalDelta: 0 }
  );
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax, ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal, delta: result.rows[0].delta, matched: result.rows[0].matched },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true }
  );
});
