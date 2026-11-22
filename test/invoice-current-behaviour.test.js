'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function riceLine() {
  return {
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: 3000,
    qty: 1
  };
}

test('pricing applies the HSN GST rate after the coupon discount', function () {
  const totals = pricing.computeTotals([riceLine()], 'SAVE10');

  assert.equal(totals.subtotal, 3000);
  assert.equal(totals.discount, 150);
  assert.equal(totals.taxable, 2850);
  assert.equal(totals.tax, 142.5);
  assert.equal(totals.cgst, 71.25);
  assert.equal(totals.sgst, 71.25);
  assert.equal(totals.total, 2992.5);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('invoice figures match the billed HSN and post-discount totals', function () {
  const items = [{ ...riceLine(), price: 640 }];
  const ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  const order = { items: items, coupon: 'SAVE10', total: ledgerTotals.total };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(ledgerTotals.total, 604.8);
  assert.equal(figures.subtotal, ledgerTotals.subtotal);
  assert.equal(figures.discount, ledgerTotals.discount);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.equal(figures.tax, ledgerTotals.tax);
  assert.equal(figures.cgst, ledgerTotals.cgst);
  assert.equal(figures.sgst, ledgerTotals.sgst);
  assert.equal(figures.total, ledgerTotals.total);
  assert.match(html, /5%/);
  assert.match(html, /CGST<\/td><td class="r">₹14\.40/);
  assert.match(html, /SGST<\/td><td class="r">₹14\.40/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹604\.80/);
});

test('invoice uses the HSN 1006 slab for a line without a stored gstRate', function () {
  const figures = invoice.computeInvoiceFigures({ items: [riceLine()], coupon: '' });

  assert.equal(figures.subtotal, 3000);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 150);
  assert.equal(figures.tax, 150);
  assert.equal(figures.cgst, 75);
  assert.equal(figures.sgst, 75);
  assert.equal(figures.total, 3150);
});

test('invoice applies SAVE10 using the billed max discount and taxable amount', function () {
  const items = [riceLine()];
  const ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    date: '01/01/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: ledgerTotals.subtotal,
    discount: ledgerTotals.discount,
    tax: ledgerTotals.tax,
    total: ledgerTotals.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerTotals.discount, 150);
  assert.equal(ledgerTotals.total, 2992.5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 142.5);
  assert.equal(figures.tax, 142.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.cgst, 71.25);
  assert.equal(figures.sgst, 71.25);
  assert.equal(figures.total, 2992.5);
});

test('GST reconciliation reports the invoice and ledger as matching', function () {
  const items = [riceLine()];
  const ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    date: '01/01/2022',
    customer: 'In-memory customer',
    coupon: 'SAVE10',
    items: items,
    subtotal: ledgerTotals.subtotal,
    discount: ledgerTotals.discount,
    tax: ledgerTotals.tax,
    total: ledgerTotals.total
  };

  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 142.5);
  assert.equal(reconciliation.rows[0].invoiceTax, 142.5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 2992.5);
  assert.equal(reconciliation.rows[0].invoiceTotal, 2992.5);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
