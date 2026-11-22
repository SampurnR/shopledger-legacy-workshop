'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Mirrors the item shape saved by routes/orders.js; deliberately in memory.
function checkoutItems(price, qty, hsn) {
  return [{
    id: 1,
    sku: 'TEST-001',
    name: 'Test rice',
    hsn: hsn || '1006',
    price: price,
    qty: qty
  }];
}

function orderFromCheckout(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '01/01/2021',
    status: 'completed',
    customer: 'In-memory customer',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice uses the order HSN GST slab and matches billed GST breakdown', function () {
  const items = checkoutItems(640, 1, '1006');
  const ledger = pricing.computeTotals(items, '');
  const printedInvoice = invoice.computeInvoiceFigures(orderFromCheckout(items, ''));

  assert.deepEqual(
    { tax: printedInvoice.tax, cgst: printedInvoice.cgst, sgst: printedInvoice.sgst, total: printedInvoice.total },
    { tax: ledger.tax, cgst: ledger.cgst, sgst: ledger.sgst, total: ledger.total }
  );
  assert.equal(printedInvoice.rows[0].gstPercent, ledger.lines[0].gstPercent);
  assert.equal(printedInvoice.rows[0].lineTax, ledger.lines[0].tax);
});

test('Invoice applies SAVE10 to subtotal and GST matches the billed post-discount value', function () {
  const items = checkoutItems(1000, 1, '1006');
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures(orderFromCheckout(items, 'SAVE10'));

  assert.deepEqual(
    { discount: printedInvoice.discount, tax: printedInvoice.tax, total: printedInvoice.total },
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total }
  );
  assert.equal(printedInvoice.rows[0].lineTax, ledger.lines[0].tax);
});

test('Invoice respects the SAVE10 maximum discount used when billing the order', function () {
  const items = checkoutItems(3000, 1, '1006');
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures(orderFromCheckout(items, 'SAVE10'));

  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.discount, 150);
  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.total, ledger.total);
});

test('GST reconciliation matches billed totals and skips cancelled orders', function () {
  const activeOrder = orderFromCheckout(checkoutItems(1000, 1, '1006'), '');
  const cancelledOrder = { ...activeOrder, id: 2, status: 'cancelled' };
  const result = reports.getGstReconciliation({ orders: [activeOrder, cancelledOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceTax, result.rows[0].ledgerTax);
  assert.equal(result.rows[0].invoiceTotal, result.rows[0].ledgerTotal);
  assert.equal(result.rows[0].matched, true);
});
