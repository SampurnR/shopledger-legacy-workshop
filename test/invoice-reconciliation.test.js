const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice applies HSN GST after proportionally applying coupon discount', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(ledger.tax, 30.4);
  assert.equal(ledger.total, 638.4);
  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.rows[0].lineTax, 30.4);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.total, ledger.total);
});

test('invoice uses the ledger HSN rate and applies coupon before calculating GST', function () {
  const items = [{ id: 5, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1020, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(printedInvoice.rows[0].gstPercent, 5);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.total, ledger.total);
});

test('invoice coupon follows the ledger minimum and maximum discount rules', function () {
  const items = [{ id: 2, name: 'Generic goods', price: 5000, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 873);
  assert.equal(ledger.total, 5723);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.total, ledger.total);
});

test('invoice does not apply an inactive coupon present in config', function () {
  const items = [{ id: 3, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'DIWALI20');
  const printedInvoice = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(ledger.discount, 0);
  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.total, ledger.total);
});

test('GST reconciliation matches the invoice to the ledger', function () {
  const items = [{ id: 4, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const db = {
    orders: [{
      id: 9001,
      date: '15/11/2026',
      customer: 'In-memory customer',
      status: 'completed',
      coupon: 'WELCOME',
      items: items,
      subtotal: ledger.subtotal,
      discount: ledger.discount,
      tax: ledger.tax,
      total: ledger.total
    }, {
      id: 9002,
      status: 'cancelled',
      items: [],
      total: 0,
      tax: 0
    }]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 30.4);
  assert.equal(result.rows[0].invoiceTax, 30.4);
  assert.equal(result.rows[0].ledgerTotal, 638.4);
  assert.equal(result.rows[0].invoiceTotal, 638.4);
  assert.equal(result.rows[0].matched, true);
});
