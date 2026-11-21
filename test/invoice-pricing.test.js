'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice GST breakdown and total match the order pricing for an HSN-rated item', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, '');
  const order = { id: 1001, date: '01/01/2022', items: items, coupon: '', total: orderTotals.total };
  const invoiceTotals = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(
    { subtotal: invoiceTotals.subtotal, discount: invoiceTotals.discount, tax: invoiceTotals.tax, cgst: invoiceTotals.cgst, sgst: invoiceTotals.sgst, total: invoiceTotals.total },
    { subtotal: orderTotals.subtotal, discount: orderTotals.discount, tax: orderTotals.tax, cgst: orderTotals.cgst, sgst: orderTotals.sgst, total: orderTotals.total }
  );
  assert.equal(invoiceTotals.rows[0].gstPercent, 5);
  assert.equal(invoiceTotals.rows[0].lineTax, 5);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /<td class="r">₹5\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.equal(html.includes('Accountant Reconciliation Notice'), false);
});

test('invoice discount and GST breakdown match the billed order with a coupon', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, 'SAVE10');
  const invoiceTotals = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: invoiceTotals.subtotal, discount: invoiceTotals.discount, tax: invoiceTotals.tax, cgst: invoiceTotals.cgst, sgst: invoiceTotals.sgst, total: invoiceTotals.total },
    { subtotal: orderTotals.subtotal, discount: orderTotals.discount, tax: orderTotals.tax, cgst: orderTotals.cgst, sgst: orderTotals.sgst, total: orderTotals.total }
  );
  assert.equal(invoiceTotals.discount, 60);
  assert.equal(invoiceTotals.rows[0].lineTax, 27);
});

test('invoice uses the same configured coupon cap as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 5000, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, 'WHOLESALE15');
  const invoiceTotals = invoice.computeInvoiceFigures({ items: items, coupon: 'WHOLESALE15' });

  assert.equal(invoiceTotals.discount, orderTotals.discount);
  assert.equal(invoiceTotals.discount, 400);
  assert.equal(invoiceTotals.total, orderTotals.total);
});

test('GST reconciliation marks an invoice matching its in-memory billed order as balanced', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, '');
  const db = {
    orders: [{
      id: 1001,
      date: '01/01/2022',
      customer: 'Walk-in',
      items: items,
      coupon: '',
      subtotal: orderTotals.subtotal,
      discount: orderTotals.discount,
      tax: orderTotals.tax,
      total: orderTotals.total,
      status: 'completed'
    }]
  };

  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 5);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 105);
  assert.equal(reconciliation.rows[0].invoiceTotal, 105);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
