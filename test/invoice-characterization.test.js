'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the discounted HSN slab calculated by order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total, gstPercent: billed.lines[0].gstPercent },
    { discount: 150, tax: 92.5, total: 1942.5, gstPercent: 5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total, gstPercent: printed.rows[0].gstPercent },
    { discount: 150, tax: 92.5, total: 1942.5, gstPercent: 5 }
  );
});

test('invoice treats a fractional gstRate as a decimal rate', function () {
  const items = [{ id: 2, name: 'Tea', price: 100, qty: 1, gstRate: 0.05 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('reconciliation matches invoice and ledger totals and omits cancelled orders', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    date: '28/11/2026',
    customer: 'Walk-in',
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const cancelledOrder = Object.assign({}, order, { id: 1002, status: 'cancelled' });

  const result = reports.getGstReconciliation({ orders: [order, cancelledOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    { delta: result.rows[0].delta, invoiceTax: result.rows[0].invoiceTax, ledgerTax: result.rows[0].ledgerTax, matched: result.rows[0].matched },
    { delta: 0, invoiceTax: 92.5, ledgerTax: 92.5, matched: true }
  );
});
