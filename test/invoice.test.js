'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(items, coupon, totals) {
  return {
    id: 1001,
    date: '22/11/2026',
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

test('invoice uses the HSN slab and matches the charged tax and total', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.cgst, 2.5);
  assert.equal(ledger.sgst, 2.5);
  assert.equal(ledger.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});

test('WELCOME coupon uses the same discount base and post-discount GST as the charged order', function () {
  const items = [{ id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const order = makeOrder(items, 'WELCOME', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 5);
  assert.equal(ledger.tax, 17.1);
  assert.equal(ledger.total, 112.1);
  assert.equal(invoiceFigures.discount, 5);
  assert.equal(invoiceFigures.tax, 17.1);
  assert.equal(invoiceFigures.cgst, 8.55);
  assert.equal(invoiceFigures.sgst, 8.55);
  assert.equal(invoiceFigures.total, 112.1);
});

test('WHOLESALE15 respects the configured cap and matches the charged order', function () {
  const items = [{ id: 3, name: 'Tea case', sku: 'TEA-CASE', hsn: '0902', price: 100, qty: 30 }];
  const ledger = pricing.computeTotals(items, 'WHOLESALE15');
  const order = makeOrder(items, 'WHOLESALE15', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 400);
  assert.equal(ledger.tax, 468);
  assert.equal(ledger.total, 3068);
  assert.equal(invoiceFigures.discount, 400);
  assert.equal(invoiceFigures.tax, 468);
  assert.equal(invoiceFigures.total, 3068);
});

test('decimal gstRate uses the same rate interpretation as order pricing', function () {
  const items = [{ id: 4, name: 'Special item', sku: 'SPECIAL-1', hsn: '', gstRate: 0.05, price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('reconciliation matches an HSN-priced invoice to the in-memory charged order', function () {
  const items = [{ id: 5, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', ledger);
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].matched, true);
});

test('FLAT50 reduces the invoice taxable base before GST just as it does at checkout', function () {
  const items = [{ id: 6, name: 'Tea', sku: 'TEA-2', hsn: '0902', price: 300, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'FLAT50');
  const order = makeOrder(items, 'FLAT50', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 50);
  assert.equal(ledger.tax, 45);
  assert.equal(ledger.total, 295);
  assert.equal(invoiceFigures.discount, 50);
  assert.equal(invoiceFigures.tax, 45);
  assert.equal(invoiceFigures.total, 295);
});

test('inactive coupon is not applied to the invoice', function () {
  const items = [{ id: 7, name: 'Tea', sku: 'TEA-3', hsn: '0902', price: 1000, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, 'DIWALI20', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.discount, 0);
  assert.equal(ledger.total, 1180);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.tax, 180);
  assert.equal(invoiceFigures.total, 1180);
});

test('invoice line tax rounding and total tax rounding match the charged order', function () {
  const items = [
    { id: 8, name: 'Small item A', sku: 'SMALL-A', hsn: '0902', price: 0.03, qty: 1 },
    { id: 9, name: 'Small item B', sku: 'SMALL-B', hsn: '0902', price: 0.03, qty: 1 }
  ];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 0.02);
  assert.equal(ledger.total, 0.08);
  assert.equal(invoiceFigures.rows[0].lineTax, 0.01);
  assert.equal(invoiceFigures.rows[1].lineTax, 0.01);
  assert.equal(invoiceFigures.tax, 0.02);
  assert.equal(invoiceFigures.total, 0.08);
});

test('reconciliation reports no mismatch when coupon invoice tax and total match checkout', function () {
  const items = [{ id: 10, name: 'Tea', sku: 'TEA-4', hsn: '0902', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const order = makeOrder(items, 'WELCOME', ledger);
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.rows[0].ledgerTotal, result.rows[0].invoiceTotal);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].ledgerTax, 17.1);
  assert.equal(result.rows[0].invoiceTax, 17.1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('empty item lists produce a zero-value invoice', function () {
  const items = [];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', ledger);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.subtotal, 0);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.tax, 0);
  assert.equal(invoiceFigures.cgst, 0);
  assert.equal(invoiceFigures.sgst, 0);
  assert.equal(invoiceFigures.total, 0);
  assert.deepEqual(invoiceFigures.rows, []);
});

test('rendered invoice retains a reconciliation warning for an inconsistent stored total', function () {
  const items = [{ id: 11, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = makeOrder(items, '', Object.assign({}, ledger, { total: 104 }));
  const html = invoice.render(order);

  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice computed total/);
  assert.match(html, /differs from Order Ledger recorded total/);
});

test('invoice GST breakdown and total match the amount charged for an HSN-priced order', function () {
  const items = [{ id: 12, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 100, qty: 1 }];
  const charged = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(makeOrder(items, '', charged));

  assert.equal(invoiceFigures.discount, charged.discount);
  assert.equal(invoiceFigures.tax, charged.tax);
  assert.equal(invoiceFigures.cgst, charged.cgst);
  assert.equal(invoiceFigures.sgst, charged.sgst);
  assert.equal(invoiceFigures.total, charged.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, charged.lines[0].gstPercent);

  const html = invoice.render(makeOrder(items, '', charged));
  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
});
