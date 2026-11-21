'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function orderWith(items, coupon, totals) {
  return {
    id: 42,
    date: '21/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice GST and total match billed HSN-slab figures', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(orderWith(items, '', billed));

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total, rowGstPercent: printed.rows[0].gstPercent },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total, rowGstPercent: 5 }
  );
});

test('invoice applies SAVE10 to taxable value before GST and matches billed line tax', function () {
  const items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(orderWith(items, 'SAVE10', billed));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, taxable: billed.taxable, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 100, taxable: 900, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total, rowTax: printed.rows[0].lineTax },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total, rowTax: billed.lines[0].tax }
  );
});

test('invoice preserves stored gstRate behavior used by pricing on historical order lines', function () {
  const items = [{ id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', gstRate: 12, price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(orderWith(items, '', billed));

  assert.deepEqual(
    { billedTax: billed.tax, billedTotal: billed.total, invoiceTax: printed.tax, invoiceTotal: printed.total, rowGstPercent: printed.rows[0].gstPercent },
    { billedTax: 12, billedTotal: 112, invoiceTax: 12, invoiceTotal: 112, rowGstPercent: 12 }
  );
});

test('invoice preserves the recorded discount for an order whose coupon is now inactive', function () {
  const items = [{ id: 5, name: 'Rice', sku: 'RICE-5', hsn: '1006', price: 1000, qty: 1 }];
  const historicalOrder = orderWith(items, 'DIWALI20', {
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  });
  const printed = invoice.computeInvoiceFigures(historicalOrder);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total, rowTax: printed.rows[0].lineTax },
    { subtotal: 1000, discount: 200, tax: 40, cgst: 20, sgst: 20, total: 840, rowTax: 40 }
  );
});

test('GST reconciliation matches billed invoice and excludes cancelled in-memory orders', function () {
  const items = [{ id: 3, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const order = orderWith(items, '', billed);
  const result = reports.getGstReconciliation({
    orders: [order, Object.assign({}, order, { id: 43, status: 'cancelled' })]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax, ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal, delta: result.rows[0].delta, matched: result.rows[0].matched },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true }
  );
});

test('GST reconciliation still detects stored tax and total that differ from recomputed invoice figures', function () {
  const items = [{ id: 6, name: 'Rice', sku: 'RICE-6', hsn: '1006', price: 100, qty: 1 }];
  const order = orderWith(items, '', {
    subtotal: 100,
    discount: 0,
    tax: 6,
    total: 106
  });
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, -1);
  assert.equal(result.rows[0].matched, false);
});
